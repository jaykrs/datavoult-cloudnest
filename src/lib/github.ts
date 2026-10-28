/** Minimal GitHub client: list the caller's repositories that contain a Dockerfile (one GraphQL call). */

export interface GithubRepo {
  fullName: string;
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  pushedAt: string | null;
}

export class GithubError extends Error {
  constructor(public kind: 'BAD_TOKEN' | 'RATE_LIMIT' | 'UNAVAILABLE', message: string) {
    super(message);
  }
}

export const GITHUB_TOKEN_PATTERN = /^[A-Za-z0-9_.=-]{8,255}$/;

const QUERY = `query {
  viewer {
    login
    repositories(first: 100, isArchived: false, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        nameWithOwner url isPrivate description pushedAt
        defaultBranchRef { name }
        dockerfile: object(expression: "HEAD:Dockerfile") { __typename }
      }
    }
  }
}`;

interface Node {
  nameWithOwner: string; url: string; isPrivate: boolean; description: string | null; pushedAt: string | null;
  defaultBranchRef: { name: string } | null; dockerfile: { __typename: string } | null;
}

/**
 * The 100 most recently pushed repositories the token can see, filtered to those with a
 * `Dockerfile` at the root. The token is used for this one request and never stored or logged.
 */
export async function listDockerRepos(token: string, fetchImpl: typeof fetch = fetch): Promise<{ login: string; repos: GithubRepo[]; scanned: number }> {
  if (!GITHUB_TOKEN_PATTERN.test(token)) throw new GithubError('BAD_TOKEN', 'That does not look like a GitHub access token');
  let res: Response;
  try {
    res = await fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'datavoult-cloudnest' },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GithubError('UNAVAILABLE', 'Could not reach GitHub. Please try again.');
  }
  if (res.status === 401) throw new GithubError('BAD_TOKEN', 'GitHub rejected this token. Check it is valid and not expired.');
  if (res.status === 403 || res.status === 429) throw new GithubError('RATE_LIMIT', 'GitHub is rate limiting requests. Try again in a few minutes.');
  if (!res.ok) throw new GithubError('UNAVAILABLE', `GitHub returned an error (${res.status}).`);

  const body = (await res.json().catch(() => null)) as { data?: { viewer?: { login: string; repositories: { nodes: Array<Node | null> } } }; errors?: Array<{ type?: string; message?: string }> } | null;
  if (body?.errors?.some((e) => e.type === 'RATE_LIMITED')) throw new GithubError('RATE_LIMIT', 'GitHub is rate limiting requests. Try again in a few minutes.');
  const viewer = body?.data?.viewer;
  if (!viewer) throw new GithubError('BAD_TOKEN', 'GitHub did not accept this token (it needs read access to your repositories).');

  const nodes = viewer.repositories.nodes.filter((n): n is Node => Boolean(n));
  const repos = nodes
    .filter((n) => n.dockerfile && n.url.startsWith('https://github.com/'))
    .map((n) => ({
      fullName: n.nameWithOwner,
      cloneUrl: n.url,
      private: n.isPrivate,
      defaultBranch: n.defaultBranchRef?.name || 'main',
      description: n.description,
      pushedAt: n.pushedAt,
    }));
  return { login: viewer.login, repos, scanned: nodes.length };
}
