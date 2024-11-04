# MapLibre GL JS (Custom)

```bash
rm -rf .devcontainer .github .vscode developer-guides docs test *.md
jq '.name = "@0xfa11/maplibre-gl" | .repository = "https://github.com/0xFA11/maplibre-gl-js" | del(.devDependencies.canvas)' package.json | sponge package.json
jq '{name,repository,version,license,main,style,types,type,dependencies,devDependencies,scripts,files,engines}' package.json | sponge package.json
jq '.exclude += ["**/*.test.*"] | .compilerOptions.types += ["node"]' tsconfig.json | sponge tsconfig.json
npm install && npm run build-css && npm run generate-typings && npm run build-prod
```

```bash
git remote add upstream https://github.com/maplibre/maplibre-gl-js.git
git fetch upstream main
git rebase -i upstream/main
```
