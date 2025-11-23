import client from './client';
import { TeamRewardsResponse, TeamStructureResponse } from '../../../../types/api-contracts';

export const fetchTeam = async () => {
  const { data } = await client.get<TeamStructureResponse>('/team');
  return data;
};

export const fetchStats = async () => {
  const { data } = await client.get<TeamRewardsResponse>('/team/rewards');
  return data;
};
