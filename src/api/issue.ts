import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

export const octokit = new Octokit({
  auth: process.env.ISSUE_TOKEN,
  request: {
    fetch: fetch,
  },
}) as any;

export type IState = 'all' | 'open' | 'closed' | undefined;

// 获取某个仓库的所有 issues
const _getIssues = async (params: {
  owner: string;
  repo: string;
  page?: number;
  per_page?: number;
  creator?: string; // 过滤某个人的 issues
  state?: IState; //
  desc?: string; //
  since?: string; // YYYY-MM-DDTHH:MM:SSZ
}) => {
  const { owner, repo, page, per_page, creator, state, since } = params;
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    page,
    per_page,
    creator,
    state,
    since,
  });

  return issues;
};

export default (params: {
  owner: string;
  repo: string;
  page?: number;
  per_page?: number;
  creator?: string; // 过滤某个人的 issues
  state?: IState; //
  desc?: string; //
}) => {
  return _getIssues(params).then((data: any) => {
    const issues = data.filter(({ html_url }: any) => html_url.includes('issues'));
    const pullRequests = data.filter(({ html_url }: any) => html_url.includes('pull'));

    return {
      issues,
      pullRequests,
      // issues: issues.map(({ title, html_url, state, created_at }: any) => ({ title, html_url, state, created_at })),
      // pullRequests: pullRequests.map(({ title, html_url, state, created_at }: any) => ({
      //   title,
      //   html_url,
      //   state,
      //   created_at,
      // })),
      total: data.length,
      raw: data,
      repository_name: `https://github.com/${params.owner}/${params.repo}`,
    };
  });
};
