
import FlavorCard from './FlavorCard';

const Flavors = () => {
  const flavors = [
    { name: 'Leite Ninho', image: '/images/leite-ninho.jpg', isFavorite: true },
    { name: 'Chocolate', image: '/images/chocolate.jpg', isFavorite: false },
    { name: 'Morango', image: '/images/morango.jpg', isFavorite: false },
    { name: 'Cappuccino', image: '/images/cappuccino.jpg', isFavorite: false },
    { name: 'Doce de Leite', image: '/images/doce-leite.jpg', isFavorite: false },
    { name: 'Ninho com Morango', image: '/images/ninho-morango.jpg', isFavorite: false },
    { name: 'Chocolate Branco', image: '/images/chocolate-branco.jpg', isFavorite: false },
    { name: 'Prestígio', image: '/images/prestigio.jpg', isFavorite: false },
  ];

  return (
    <section id="sabores" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-bebas text-5xl md:text-6xl text-white mb-4">
            NOSSOS SABORES
          </h2>
          <p className="font-serif text-lg text-gray-300 max-w-2xl mx-auto">
            Descubra nossa variedade de sabores artesanais, cada um preparado com ingredientes selecionados e muito carinho.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {flavors.map((flavor, index) => (
            <FlavorCard
              key={index}
              name={flavor.name}
              image={flavor.image}
              isFavorite={flavor.isFavorite}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Flavors; 