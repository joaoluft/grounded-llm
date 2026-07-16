# ESLint + Prettier Setup

## Visão Geral

Este projeto está configurado com **ESLint** para análise estática de código e **Prettier** para formatação automática, seguindo o padrão JavaScript/TypeScript da comunidade com **2 spaces de indentação**.

## Configuração

### ESLint (`eslint.config.js`)

- **Parser**: `@typescript-eslint/parser` para suporte a TypeScript
- **Regras**:
  - Recomendações padrão do ESLint e @typescript-eslint
  - Proíbe `any` (com warnings)
  - Remove variáveis não utilizadas (exceto prefixadas com `_`)
  - Integração com Prettier

### Prettier (`.prettierrc.json`)

```json
{
  "printWidth": 100,
  "tabWidth": 2, // ← 2 SPACES (padrão JS/TS)
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

### VSCode Settings (`.vscode/settings.json`)

Configuração automática do editor:

- **Editor default formatter**: Prettier
- **Format on save**: Ativado
- **Format on paste**: Ativado
- **Tab size**: 2 spaces
- **Insert spaces**: Habilitado

## Scripts npm

```bash
# Verificar qualidade de código
npm run lint              # ESLint + relatório de warnings/erros
npm run lint:fix          # ESLint + auto-correção

# Formatar código
npm run format            # Prettier + formatação automática
npm run format:check      # Prettier + apenas verificação

# Verificação completa
npm run quality           # Lint + format:check + test + build
```

## Como Usar

### VSCode (Recomendado)

1. Instale as extensões recomendadas:
   - **Prettier** (`esbenp.prettier-vscode`)
   - **ESLint** (`dbaeumer.vscode-eslint`)

2. Configure padrão com 2 spaces automaticamente:
   - Salvar arquivo → Prettier formata automaticamente
   - Paste → Prettier formata automaticamente
   - VSCode já respeita `.vscode/settings.json`

### Terminal

```bash
# Formatar todos os arquivos
npm run format

# Verificar se está tudo OK
npm run quality

# Corrigir erros automáticos
npm run lint:fix
```

## Regras ESLint

| Regra             | Nível | Descrição                   |
| ----------------- | ----- | --------------------------- |
| `no-unused-vars`  | error | Variáveis não utilizadas    |
| `no-explicit-any` | warn  | Uso de `any` em TypeScript  |
| `no-console`      | warn  | Console (exceto warn/error) |

## Ignored Files

Arquivos ignorados pelo ESLint e Prettier:

- `node_modules/`
- `dist/`
- `coverage/`
- `*.config.ts` / `*.config.js`
- `.next/`
- `build/`

## Exemplo de Formatação

### Antes (sem Prettier)

```typescript
const foo: string = 'bar';
const baz: number = 123;
```

### Depois (com Prettier + 2 spaces)

```typescript
const foo: string = 'bar';
const baz: number = 123;
```

## Troubleshooting

### ESLint não formata ao salvar

Verifique se Prettier está instalado como extensão do VSCode e se `.vscode/settings.json` tem `"editor.defaultFormatter": "esbenp.prettier-vscode"`

### Conflito entre ESLint e Prettier

Esse projeto usa `eslint-plugin-prettier` que integra Prettier direto no ESLint. Se houver conflitos:

```bash
npm run lint:fix  # Corrige ambos automaticamente
```

### Indentar com 4 spaces ao invés de 2

Edite `.prettierrc.json` e altere `"tabWidth": 4`, depois execute:

```bash
npm run format
```

## CI/CD

Para validação em CI:

```bash
npm run quality  # Executa tudo: lint → format:check → test → build
```

Se falhar, execute localmente e corrija:

```bash
npm run lint:fix && npm run format
```

---

**Status**: ✅ Configurado e pronto para usar com formatação automática de 2 spaces em todos os arquivos TypeScript
