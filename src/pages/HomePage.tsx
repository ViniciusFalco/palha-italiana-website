
import Header from '../components/Header';
import HeroSlider from '../components/HeroSlider';
import Flavors from '../components/Flavors';
import Catering from '../components/Catering';
import Footer from '../components/Footer';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <HeroSlider />
        <Flavors />
        <Catering />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage; 