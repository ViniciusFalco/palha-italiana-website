# 🚀 Instruções de Deploy - Palha Italiana

## Passo a Passo para Deploy no Vercel

### 1. Criar Repositório no GitHub

1. Acesse [github.com](https://github.com)
2. Clique em "New repository"
3. Nome: `palha-italiana-website`
4. Descrição: `Site oficial da Palha Italiana - Doces Artesanais`
5. Deixe público ou privado (sua escolha)
6. **NÃO** inicialize com README, .gitignore ou license
7. Clique em "Create repository"

### 2. Conectar Repositório Local ao GitHub

Execute estes comandos no terminal (já estamos no diretório correto):

```bash
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/palha-italiana-website.git
git push -u origin main
```

**Substitua `SEU-USUARIO` pelo seu nome de usuário do GitHub**

### 3. Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em "New Project"
4. Na lista de repositórios, clique em "Import" no repositório `palha-italiana-website`
5. A Vercel detectará automaticamente:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Clique em "Deploy"

### 4. Configurações do Projeto (Opcional)

Após o deploy, você pode configurar:

#### Domínio Customizado
1. Vá em Settings > Domains
2. Adicione seu domínio (ex: palhaitaliana.com.br)
3. Configure os registros DNS conforme instruções

#### Variáveis de Ambiente
1. Vá em Settings > Environment Variables
2. Adicione se necessário:
   - `VITE_WHATSAPP_NUMBER`: 5532984669122

### 5. Verificar Deploy

Após o deploy, verifique:

- [ ] Site carrega corretamente
- [ ] Logo aparece no header
- [ ] Clique na logo leva para página inicial
- [ ] Navegação funciona
- [ ] Slider está funcionando com os 3 novos slides
- [ ] Seção de sabores mostra os 8 sabores corretos
- [ ] Carrinho de compras funciona
- [ ] Checkout com cupom funciona
- [ ] Integração WhatsApp funciona

### 6. Próximos Passos

#### Adicionar Imagens Obrigatórias

**IMAGENS DO SLIDER (PRIORIDADE ALTA):**
- `romeu-julieta.jpg` - Slide 1: Sabor Romeu e Julieta
- `cappuccino-hero.jpg` - Slide 2: Cappuccino
- `finc-event.jpg` - Slide 3: Evento FINC

**IMAGENS DOS SABORES (PRIORIDADE ALTA):**
- `leite-ninho.jpg` - Leite Ninho (Sabor favorito)
- `chocolate.jpg` - Chocolate
- `churros.jpg` - Churros
- `prestigio.jpg` - Prestígio
- `pacoca.jpg` - Paçoca
- `cappuccino.jpg` - Cappuccino
- `limao-siciliano.jpg` - Limão Siciliano
- `romeu-julieta.jpg` - Romeu e Julieta

**IMAGENS DE EMBALAGEM:**
- `caixa-individual.jpg`, `caixa-6.jpg`, `caixa-12.jpg`
- `caixa-24.jpg`, `caixa-48.jpg`, `caixa-96.jpg`

**IMAGENS DE PRODUTOS:**
- `kit-festa-50.jpg`, `kit-festa-100.jpg`
- `palha-individual.jpg`, `caixa-6-palhas.jpg`, `caixa-12-palhas.jpg`
- `torta-rustica-1kg.jpg`, `torta-rustica-2kg.jpg`
- `torta-personalizada-1kg.jpg`, `torta-personalizada-2kg.jpg`

#### Adicionar Fonte Customizada
1. Baixe a fonte Sour Gummy (.ttf)
2. Adicione em `src/assets/fonts/SourGummy.ttf`
3. Faça commit e push das alterações

### 7. URLs Importantes

- **Site**: https://palha-italiana-website.vercel.app (ou seu domínio customizado)
- **WhatsApp**: https://wa.me/5532984669122
- **Admin Vercel**: https://vercel.com/dashboard

### 8. Comandos Úteis

```bash
# Para atualizações futuras
git add .
git commit -m "Descrição da atualização"
git push

# A Vercel fará deploy automático após cada push
```

---

## 🎉 Seu site estará online em minutos!

**URL do site**: https://palha-italiana-website.vercel.app

**Status**: ✅ Pronto para deploy
**Logo**: ✅ Adicionada ao header
**Slider**: ✅ Atualizado com 3 novos slides
**Sabores**: ✅ Atualizados com 8 sabores corretos
**Responsividade**: ✅ Implementada
**Funcionalidades**: ✅ Todas implementadas 