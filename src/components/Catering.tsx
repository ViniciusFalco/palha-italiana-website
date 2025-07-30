
import OrderButton from './OrderButton';

const Catering = () => {
  const packagingExamples = [
    { name: 'Caixa Individual', image: '/images/caixa-individual.jpg' },
    { name: 'Caixa 6 Unidades', image: '/images/caixa-6.jpg' },
    { name: 'Caixa 12 Unidades', image: '/images/caixa-12.jpg' },
    { name: 'Caixa 24 Unidades', image: '/images/caixa-24.jpg' },
    { name: 'Caixa 48 Unidades', image: '/images/caixa-48.jpg' },
    { name: 'Caixa 96 Unidades', image: '/images/caixa-96.jpg' },
  ];

  const toppings = [
    'Granulado Colorido', 'Granulado Chocolate', 'Granulado Branco',
    'Confete', 'Chocolate em Pó', 'Coco Ralado', 'Amendoim Picado',
    'Castanha de Caju', 'Nozes', 'Frutas Secas'
  ];

  return (
    <section id="encomendas" className="py-16 bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-bebas text-5xl md:text-6xl text-white mb-4">
            ENCOMENDAS
          </h2>
          <p className="font-serif text-lg text-gray-300 max-w-2xl mx-auto">
            Perfeitas para festas, eventos e presentear quem você ama!
          </p>
        </div>

        {/* Packaging Examples Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {packagingExamples.map((item, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 text-center">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
              <h3 className="font-gummy text-white text-sm">{item.name}</h3>
            </div>
          ))}
        </div>

        {/* Tortas Rústicas */}
        <div className="mb-8">
          <h3 className="font-bebas text-3xl text-white mb-4">TORTAS RÚSTICAS</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="font-serif text-white">
                <span className="font-bold">1kg:</span> R$ 45,00
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="font-serif text-white">
                <span className="font-bold">2kg:</span> R$ 85,00
              </p>
            </div>
          </div>
        </div>

        {/* Tortas Personalizadas */}
        <div className="mb-8">
          <h3 className="font-bebas text-3xl text-white mb-4">TORTAS PERSONALIZADAS</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="font-serif text-white">
                <span className="font-bold">1kg:</span> R$ 55,00
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="font-serif text-white">
                <span className="font-bold">2kg:</span> R$ 105,00
              </p>
            </div>
          </div>

          {/* Toppings */}
          <div>
            <h4 className="font-bebas text-xl text-primary mb-3">COBERTURAS DISPONÍVEIS:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {toppings.map((topping, index) => (
                <div key={index} className="bg-gray-800 p-2 rounded text-center">
                  <p className="font-serif text-white text-sm">{topping}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Button */}
        <div className="text-center">
          <OrderButton className="text-lg px-8 py-3" />
        </div>
      </div>
    </section>
  );
};

export default Catering; 