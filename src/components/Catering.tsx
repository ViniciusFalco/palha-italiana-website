
import { useNavigate } from 'react-router-dom';

const Catering = () => {
  const navigate = useNavigate();

  const goToOrderPage = () => {
    navigate('/pedidos');
  };

  return (
    <section id="encomendas" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-bebas text-5xl md:text-6xl text-primary mb-4">
            ENCOMENDAS
          </h2>
          <p className="font-serif text-lg text-gray-300 max-w-2xl mx-auto">
            Perfeitas para festas, eventos e presentear quem você ama!
          </p>
        </div>

        {/* Call to Action */}
        <div className="text-center mb-12">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-10 max-w-4xl mx-auto border border-gray-700 shadow-2xl">
            <div className="mb-8">
              <p className="font-serif text-gray-300 mb-6 text-xl leading-relaxed">
                Explore nossa variedade de sabores, embalagens e opções personalizadas. 
                Temos soluções perfeitas para todos os tipos de eventos e ocasiões especiais.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="text-primary text-3xl mb-2">🎂</div>
                <h4 className="font-bebas text-xl text-white mb-2">TORTAS</h4>
                <p className="font-serif text-gray-300 text-sm">Rústicas e personalizadas</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="text-primary text-3xl mb-2">🎁</div>
                <h4 className="font-bebas text-xl text-white mb-2">EMBALAGENS</h4>
                <p className="font-serif text-gray-300 text-sm">Caixas decorativas especiais</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="text-primary text-3xl mb-2">🎉</div>
                <h4 className="font-bebas text-xl text-white mb-2">FESTAS</h4>
                <p className="font-serif text-gray-300 text-sm">Kits completos para eventos</p>
              </div>
            </div>

            <button
              onClick={goToOrderPage}
              className="bg-primary hover:bg-pink-600 text-white font-bold py-4 px-10 rounded-xl transition-all duration-300 text-xl transform hover:scale-105 shadow-lg"
            >
              VER TODAS AS OPÇÕES
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Catering; 