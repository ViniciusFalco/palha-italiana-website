# 🍰 Palha Italiana - Website

Site oficial da Palha Italiana, uma confeitaria artesanal especializada em doces tradicionais italianos.

## 🚀 Tecnologias Utilizadas

- **React 18** - Framework JavaScript para interface
- **TypeScript** - Tipagem estática para JavaScript
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utilitário
- **React Router** - Roteamento da aplicação
- **Swiper.js** - Carrossel/slider para seções
- **React Icons** - Biblioteca de ícones

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── Header.tsx      # Cabeçalho com navegação
│   ├── Footer.tsx      # Rodapé
│   ├── HeroSlider.tsx  # Slider principal
│   ├── Flavors.tsx     # Seção de sabores
│   ├── Catering.tsx    # Seção de encomendas
│   ├── OrderButton.tsx # Botão de pedido
│   ├── MenuItem.tsx    # Item do menu
│   ├── Checkout.tsx    # Modal de checkout
│   └── ...
├── pages/              # Páginas da aplicação
│   ├── HomePage.tsx    # Página inicial
│   └── OrderPage.tsx   # Página de pedidos
├── types/              # Definições de tipos TypeScript
│   └── index.ts
├── assets/             # Recursos estáticos
│   ├── fonts/          # Fontes customizadas
│   └── images/         # Imagens
└── ...
```

## 🎨 Design System

### Cores
- **Background**: `#000000` (Preto)
- **Primary**: `#FF007F` (Rosa quente)
- **Text**: Branco e tons de cinza

### Tipografia
- **Bebas Neue**: Títulos e headings
- **DM Serif Text**: Texto serifado
- **Sour Gummy**: Fonte customizada para sabores

## 🛠️ Funcionalidades

### Página Inicial
- **Header Responsivo**: Navegação com menu mobile
- **Hero Slider**: 3 slides com autoplay
- **Seção de Sabores**: Grid de 8 sabores com destaque para favorito
- **Seção de Encomendas**: Opções de embalagem e tortas
- **Footer**: Links sociais e informações

### Página de Pedidos
- **Menu Categorizado**: Festas, Palhas Italianas, Tortas
- **Carrinho de Compras**: Adicionar/remover itens
- **Checkout Modal**: Formulário de dados do cliente
- **Cupom de Desconto**: "PRIMEIRACOMPRA" (5% off)
- **Integração WhatsApp**: Envio automático do pedido

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Instalação
```bash
# Clone o repositório
git clone [url-do-repositorio]

# Entre no diretório
cd palha-italiana-website

# Instale as dependências
npm install
```

### Desenvolvimento
```bash
# Inicie o servidor de desenvolvimento
npm run dev

# Acesse http://localhost:5173
```

### Build para Produção
```bash
# Gere o build otimizado
npm run build

# Visualize o build
npm run preview
```

## 📱 Responsividade

O site é totalmente responsivo e funciona em:
- 📱 Mobile (320px+)
- 📱 Tablet (768px+)
- 💻 Desktop (1024px+)

## 🔧 Configurações

### Tailwind CSS
Configurado com cores e fontes customizadas no `tailwind.config.js`

### Fontes
- Google Fonts: Bebas Neue, DM Serif Text
- Fonte customizada: Sour Gummy (requer arquivo .ttf)

### Imagens
As imagens devem ser adicionadas em `public/images/` com os nomes:
- `hero-1.jpg`, `hero-2.jpg`, `hero-3.jpg`
- `leite-ninho.jpg`, `chocolate.jpg`, etc.
- `caixa-individual.jpg`, `caixa-6.jpg`, etc.

## 📞 Integração WhatsApp

O sistema envia pedidos automaticamente para o WhatsApp:
- **Número**: +55 32 98466-9122
- **Formato**: Mensagem estruturada com dados do cliente e itens
- **Cupom**: Aplicação automática do desconto

## 🎯 Próximos Passos

- [ ] Adicionar imagens reais dos produtos
- [ ] Implementar sistema de avaliações
- [ ] Adicionar blog/notícias
- [ ] Sistema de newsletter
- [ ] PWA (Progressive Web App)
- [ ] Analytics e tracking

## 📄 Licença

Este projeto é privado e pertence à Palha Italiana.

---

**Desenvolvido com ❤️ para a Palha Italiana**
