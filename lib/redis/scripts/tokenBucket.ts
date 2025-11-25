export const TOKEN_BUCKET_LUA = `
local bucket_key = KEYS[1]
local now = tonumber(ARGV[1])
local interval_ms = tonumber(ARGV[2])
local tokens_per_interval = tonumber(ARGV[3])
local max_tokens = tonumber(ARGV[4])
local requested_tokens = tonumber(ARGV[5])

if interval_ms <= 0 then
  interval_ms = 1000
end

if tokens_per_interval <= 0 then
  tokens_per_interval = 1
end

if max_tokens <= 0 then
  max_tokens = tokens_per_interval
end

if requested_tokens <= 0 then
  requested_tokens = 1
end

local bucket = redis.call('HMGET', bucket_key, 'tokens', 'timestamp')
local available_tokens = bucket[1]
local last_refill = bucket[2]

if available_tokens == false or available_tokens == nil then
  available_tokens = max_tokens
else
  available_tokens = tonumber(available_tokens)
end

if last_refill == false or last_refill == nil then
  last_refill = now
else
  last_refill = tonumber(last_refill)
end

if now > last_refill then
  local elapsed = now - last_refill
  if elapsed > 0 then
    local intervals = math.floor(elapsed / interval_ms)
    if intervals > 0 then
      local refill = intervals * tokens_per_interval
      available_tokens = math.min(max_tokens, available_tokens + refill)
      last_refill = last_refill + (intervals * interval_ms)
    end
  end
end

local allowed = 0
local retry_after_ms = 0

if available_tokens >= requested_tokens then
  allowed = 1
  available_tokens = available_tokens - requested_tokens
else
  local deficit = requested_tokens - available_tokens
  local intervals_needed = math.ceil(deficit / tokens_per_interval)
  retry_after_ms = intervals_needed * interval_ms
end

redis.call('HMSET', bucket_key, 'tokens', available_tokens, 'timestamp', last_refill)
redis.call('PEXPIRE', bucket_key, math.max(interval_ms * 10, interval_ms + retry_after_ms))

return { allowed, available_tokens, retry_after_ms }
`
