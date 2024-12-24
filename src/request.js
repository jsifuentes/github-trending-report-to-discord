import { JSDOM } from 'jsdom';

async function getTrendingRepositoriesWithSimpleFetch(params) {
    const url = 'https://github.com/trending?' + params;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch trending repositories: ${response.statusText}`);
    }

    return await response.text();
}

export async function getTrendingRepositoriesWithParams(params) {
    const html = await getTrendingRepositoriesWithSimpleFetch(params);
    return extractRepositoriesFromTrendingHtml(html);
}

export function extractRepositoriesFromTrendingHtml(html) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const trendingReposWrapper = doc.querySelector('html body.logged-out.env-production.page-responsive div.logged-out.env-production.page-responsive div.application-main main div.position-relative.container-lg.p-responsive.pt-6');

    const trendingRepos = trendingReposWrapper.querySelectorAll('article.Box-row');
    const repos = [];

    for (const repo of trendingRepos) {
        const repoName = repo.querySelector('h2.h3.lh-condensed a').getAttribute('href');
        const [ owner, name ] = repoName.split('/').slice(1);
        const description = repo.querySelector('p')?.textContent.trim();
        const language = repo.querySelector('span[itemprop="programmingLanguage"]')?.textContent.trim() || 'N/A';
        const stars = parseInt(repo.querySelector('a[href$="/stargazers"]').textContent.trim().replace(',', ''));
        const forks = repo.querySelector('a[href$="/forks"]').textContent.trim();
        const starsToday = repo.querySelector('span.float-sm-right').textContent.trim();

        repos.push({
            owner,
            name,
            description,
            language,
            stars,
            forks,
            starsToday,
        });
    }

    return repos;
}