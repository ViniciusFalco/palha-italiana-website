# 🚀 Guia de Deploy - Palha Italiana

## Deploy na Vercel

### 1. Preparação do Repositório

1. Crie um repositório no GitHub
2. Faça push do código:
```bash
git init
git add .
git commit -m "Initial commit - Palha Italiana website"
git branch -M main
git remote add origin https://github.com/seu-usuario/palha-italiana-website.git
git push -u origin main
```

### 2. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em "New Project"
4. Importe o repositório `palha-italiana-website`
5. A Vercel detectará automaticamente que é um projeto Vite
6. Clique em "Deploy"

### 3. Configurações Recomendadas

#### Variáveis de Ambiente (se necessário)
- `VITE_WHATSAPP_NUMBER`: 5532984669122
- `VITE_SITE_URL`: https://palha-italiana.vercel.app

#### Domínio Customizado
1. Vá em Settings > Domains
2. Adicione seu domínio (ex: palhaitaliana.com.br)
3. Configure os registros DNS conforme instruções da Vercel

### 4. Pós-Deploy

#### Adicionar Imagens
1. Faça upload das imagens para `public/images/`
2. Nomes necessários:
   - `hero-1.jpg`, `hero-2.jpg`, `hero-3.jpg`
   - `leite-ninho.jpg`, `chocolate.jpg`, `morango.jpg`
   - `cappuccino.jpg`, `doce-leite.jpg`, `ninho-morango.jpg`
   - `chocolate-branco.jpg`, `prestigio.jpg`
   - `caixa-individual.jpg`, `caixa-6.jpg`, `caixa-12.jpg`
   - `caixa-24.jpg`, `caixa-48.jpg`, `caixa-96.jpg`
   - `kit-festa-50.jpg`, `kit-festa-100.jpg`
   - `palha-individual.jpg`, `caixa-6-palhas.jpg`, `caixa-12-palhas.jpg`
   - `torta-rustica-1kg.jpg`, `torta-rustica-2kg.jpg`
   - `torta-personalizada-1kg.jpg`, `torta-personalizada-2kg.jpg`

#### Adicionar Fonte Customizada
1. Baixe a fonte Sour Gummy (.ttf)
2. Adicione em `src/assets/fonts/SourGummy.ttf`

#### Testar Funcionalidades
- [ ] Navegação responsiva
- [ ] Slider funcionando
- [ ] Carrinho de compras
- [ ] Checkout com cupom
- [ ] Integração WhatsApp
- [ ] Links sociais

### 5. Monitoramento

#### Analytics (Opcional)
1. Adicione Google Analytics
2. Configure eventos de conversão
3. Monitore performance

#### Performance
- Use Lighthouse para testar
- Otimize imagens se necessário
- Configure cache adequado

### 6. Manutenção

#### Atualizações
1. Faça alterações localmente
2. Teste com `npm run dev`
3. Build com `npm run build`
4. Push para GitHub
5. Vercel fará deploy automático

#### Backup
- Mantenha backup do repositório
- Configure backup automático se necessário

---

**🎉 Seu site estará online em minutos!** 