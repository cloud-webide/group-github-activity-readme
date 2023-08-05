export declare const octokit: any;
export type IState = 'all' | 'open' | 'closed' | undefined;
declare const _default: (params: {
    owner: string;
    repo: string;
    page?: number;
    per_page?: number;
    creator?: string;
    state?: IState;
    desc?: string;
}) => Promise<{
    issues: any;
    pullRequests: any;
    total: any;
    raw: any;
    repository_name: string;
}>;
export default _default;
//# sourceMappingURL=issue.d.ts.map