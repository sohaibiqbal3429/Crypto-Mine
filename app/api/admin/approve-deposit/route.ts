import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Balance from "@/models/Balance";
import Transaction from "@/models/Transaction";
import Notification from "@/models/Notification";
import { getUserFromRequest } from "@/lib/auth";
import { applyDepositRewards, isUserActiveFromDeposits } from "@/lib/services/rewards";
import { ACTIVE_DEPOSIT_THRESHOLD, DEPOSIT_L1_PERCENT, DEPOSIT_L2_PERCENT_ACTIVE, DEPOSIT_SELF_PERCENT_ACTIVE } from "@/lib/constants/bonuses";

function badRequest(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function toObjectId(id: unknown) {
  const s = String(id ?? "");
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
}

function toDocumentId(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (value && typeof (value as { toString?: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) return badRequest("Unauthorized", 401);

    await dbConnect();

    const adminUser = await User.findById(userPayload.userId);
    if (!adminUser || adminUser.role !== "admin") return badRequest("Unauthorized", 401);

    const body = (await request.json().catch(() => null)) as { transactionId?: unknown } | null;
    const transactionId = typeof body?.transactionId === "string" ? body.transactionId.trim() : "";
    if (!transactionId) return badRequest("Transaction ID is required");

    // Validate id early
    const txOid = toObjectId(transactionId);
    if (!txOid) return badRequest("Invalid transaction id");

    // 1) ATOMIC approval to avoid races (returns null if already processed)
    const transactionDoc = await Transaction.findById(transactionId);
    if (!transactionDoc) return badRequest("Transaction not found", 404);
    if (transactionDoc.type !== "deposit") return badRequest("Invalid transaction type");
    if (transactionDoc.status === "approved") return badRequest("Transaction already approved", 409);
    if (transactionDoc.status !== "pending") return badRequest("Transaction not pending");

    transactionDoc.status = "approved";
    const approvedTx = await transactionDoc.save();

    // 2) Validate amount & user
    const amountNum = Number(approvedTx.amount ?? 0);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return badRequest("Invalid deposit amount");

    const depositorIdStr = toDocumentId(approvedTx.userId);
    if (!depositorIdStr) return badRequest("Transaction user missing");
    const depositorObjectId = toObjectId(depositorIdStr);

    // 3) Load user, compute activation + lifetime totals
    let user = await User.findById(depositorIdStr);
    if (!user && depositorObjectId) {
      user = await User.findById(depositorObjectId);
    }
    if (!user) return badRequest("User not found", 404);

    const lifetimeBefore = Number(user.depositTotal ?? 0);
    const lifetimeAfter = lifetimeBefore + amountNum;

    const wasActive = isUserActiveFromDeposits(lifetimeBefore);
    const nowActive = isUserActiveFromDeposits(lifetimeAfter);
    const activated = !wasActive && nowActive;

    user.depositTotal = lifetimeAfter;
    user.isActive = nowActive;
    user.status = nowActive ? "active" : "inactive";
    await user.save();

    // 4) Credit balance (upsert) — cannot fail on missing doc
    await Balance.updateOne(
      { userId: depositorIdStr },
      {
        $inc: { current: amountNum, totalBalance: amountNum },
        $setOnInsert: {
          totalEarning: 0,
          staked: 0,
          pendingWithdraw: 0,
          teamRewardsAvailable: 0,
          teamRewardsClaimed: 0,
        },
      },
      { upsert: true }
    );

    // 5) Rewards — best-effort (never fail the whole request)
    let rewardBreakdown: {
      selfBonus: number;
      l1Bonus: number;
      l2Bonus: number;
      l1UserId: string | null;
      l2UserId: string | null;
    } | null = null;

    try {
      const outcome = await applyDepositRewards(depositorIdStr, amountNum, {
        depositTransactionId: toDocumentId(approvedTx._id),
        depositAt: approvedTx.createdAt ?? new Date(),
        transactional: false,
      });

      rewardBreakdown = {
        selfBonus: outcome.selfBonus,
        l1Bonus: outcome.l1Bonus,
        l2Bonus: outcome.l2Bonus,
        l1UserId: outcome.l1UserId,
        l2UserId: outcome.l2UserId,
      };

      // add meta (best-effort)
      approvedTx.meta = {
        ...(approvedTx.meta ?? {}),
        bonusBreakdown: {
          selfPercent: nowActive ? DEPOSIT_SELF_PERCENT_ACTIVE * 100 : 0,
          l1Percent: DEPOSIT_L1_PERCENT * 100,
          l2Percent: nowActive ? DEPOSIT_L2_PERCENT_ACTIVE * 100 : 0,
          selfAmount: outcome.selfBonus,
          l1Amount: outcome.l1Bonus,
          l2Amount: outcome.l2Bonus,
          l1UserId: outcome.l1UserId,
          l2UserId: outcome.l2UserId,
        },
        qualifiesForActivation: activated,
      };
      await approvedTx.save().catch(() => null);
    } catch (e) {
      // Rewards failed — log, but do not break approval
      console.error("applyDepositRewards failed:", e);
    }

    // 6) Notification — best-effort
    try {
      const msg: string[] = [
        `Your deposit of $${amountNum.toFixed(2)} has been approved and credited to your account.`,
      ];
      if (activated) {
        msg.push(
          `You are now Active with lifetime deposits of $${lifetimeAfter.toFixed(
            2
          )} meeting the $${ACTIVE_DEPOSIT_THRESHOLD.toFixed(2)} activation threshold.`
        );
      } else if (nowActive) {
        msg.push("Your account remains Active.");
      } else {
        const remaining = Math.max(0, ACTIVE_DEPOSIT_THRESHOLD - lifetimeAfter);
        msg.push(`Deposit $${remaining.toFixed(2)} more in lifetime totals to become Active and unlock bonuses.`);
      }

      await Notification.create({
        userId: depositorIdStr,
        kind: "deposit-approved",
        title: "Deposit Approved",
        body: msg.join(" "),
      }).catch(() => null);
    } catch (e) {
      console.error("Notification.create failed:", e);
    }

    // 7) Success response — never 500 from here
    return NextResponse.json({
      success: true,
      activated,
      depositorActive: nowActive,
      lifetimeBefore,
      lifetimeAfter,
      rewardBreakdown,
      transactionCreatedAt: approvedTx.createdAt ? new Date(approvedTx.createdAt).toISOString() : null,
    });
  } catch (err: any) {
    // Convert common Mongoose errors to 4xx
    if (err?.name === "CastError") return badRequest("Invalid identifier");
    if (err?.code === 11000) return badRequest("Duplicate key error");
    console.error("Approve deposit (unexpected):", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
