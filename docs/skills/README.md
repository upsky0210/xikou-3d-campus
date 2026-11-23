# 專案 skill 備份

這裡是 Claude Code 專案 skill 的備份，讓學校和家裡的電腦用 git 同步。Claude Code 不會直接讀這裡，要複製到 `3Dmap/.claude/skills/` 才會生效。

## 在另一台電腦安裝或更新

1. 在 `site` 資料夾 `git pull`。
2. 在 `3Dmap` 資料夾（`site` 的上一層）用 PowerShell 執行：

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null; Copy-Item -Recurse -Force site\docs\skillsdd-teacher-npc .claude\skills```

3. 開一個新的 Claude Code 對話。

## 注意

- 這個資料夾會跟網站一起公開，不要寫 email、電話、金鑰。
- 改了 `.claude/skills/` 裡的 skill，要複製回這裡再 commit。
