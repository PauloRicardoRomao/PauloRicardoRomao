const fs = require("fs");

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;
const README_PATH = "README.md";

if (!USERNAME || !TOKEN) {
  throw new Error("As variáveis GH_USERNAME e GH_TOKEN são obrigatórias.");
}

async function githubRequest(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USERNAME,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro na API do GitHub: ${response.status} - ${text}`);
  }

  return response.json();
}

async function getAllRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated`;
    const data = await githubRequest(url);

    if (!Array.isArray(data) || data.length === 0) break;

    repos.push(...data);
    page++;
  }

  return repos.filter((repo) => !repo.fork);
}

function buildLanguageRanking(repos) {
  const languageCount = {};

  for (const repo of repos) {
    const language = repo.language || "Sem linguagem definida";
    languageCount[language] = (languageCount[language] || 0) + 1;
  }

  const sorted = Object.entries(languageCount).sort((a, b) => b[1] - a[1]);

  const totalRepos = repos.length;

  const lines = sorted.map(([language, count], index) => {
    const percent = ((count / totalRepos) * 100).toFixed(1);
    const barLength = Math.round((count / totalRepos) * 20);
    const bar = "█".repeat(barLength) + "░".repeat(20 - barLength);

    return `**${index + 1}. ${language}** — ${count} repositório(s) (${percent}%)  
\`${bar}\``;
  });

  return `
<p align="left">
  <strong>Total de repositórios analisados:</strong> ${totalRepos}
</p>

${lines.join("\n\n")}
`.trim();
}

function updateReadme(content, replacement) {
  const start = "<!-- LANGUAGES_SECTION_START -->";
  const end = "<!-- LANGUAGES_SECTION_END -->";

  const regex = new RegExp(`${start}[\\s\\S]*?${end}`, "m");

  if (!regex.test(content)) {
    throw new Error("Marcadores da seção de linguagens não encontrados no README.");
  }

  return content.replace(
    regex,
    `${start}\n${replacement}\n${end}`
  );
}

async function main() {
  const repos = await getAllRepos();
  const languageSection = buildLanguageRanking(repos);

  const currentReadme = fs.readFileSync(README_PATH, "utf8");
  const updatedReadme = updateReadme(currentReadme, languageSection);

  fs.writeFileSync(README_PATH, updatedReadme);
  console.log("README atualizado com sucesso.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
