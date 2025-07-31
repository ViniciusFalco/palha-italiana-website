
import { useEffect } from 'react';
import Header from '../components/Header';
import HeroSlider from '../components/HeroSlider';
import Flavors from '../components/Flavors';
import Catering from '../components/Catering';
import Footer from '../components/Footer';

const HomePage = () => {
  // Scroll automático para o tópico se solicitado
  useEffect(() => {
    const scrollTo = localStorage.getItem('scrollTo');
    if (scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(scrollTo);
        if (el) {
          const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
        localStorage.removeItem('scrollTo');
      }, 300);
    }
  }, []);

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