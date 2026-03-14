export default function grabGitRepoName({
    git_url,
}: {
    git_url: string;
}): string | undefined {
    const git_arr = git_url.split("/");

    const repo_name = git_arr.pop()?.replace(/\.git$/, "");
    const repo_user_name = git_arr.pop();

    return `${repo_user_name}/${repo_name}`;
}
