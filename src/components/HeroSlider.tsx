
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import Slide from './Slide';

const HeroSlider = () => {
  const slides = [
    {
      title: 'NOVIDADE:',
      subtitle: 'Sabor Romeu e Julieta',
      text: 'Dupla perfeita para dias frios e aconchegantes, proporcionando o irresistível doce de goiabada com queijo, finalizado com nossa deliciosa palha italiana.',
      backgroundImage: '/images/romeu-julieta.jpg'
    },
    {
      title: 'NOSSO SABOR ITALIANO!',
      subtitle: 'Cappuccino',
      text: 'Nossa dupla de origem italiana mescla a forte presença do Cappuccino sendo docemente servido na palha italiana.',
      backgroundImage: '/images/cappuccino-hero.jpg'
    },
    {
      title: 'PRESENÇA CONFIRMADA:',
      subtitle: 'FINC',
      text: 'Estaremos presente no evento da FINC 2025 em Cataguases MG. Venha conhecer a feira e se deliciar nos nossos sabores de palha italianas.',
      backgroundImage: '/images/finc-event.jpg'
    }
  ];

  return (
    <div className="relative w-full">
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        spaceBetween={0}
        slidesPerView={1}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={true}
        loop={true}
        className="w-full h-screen"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={index}>
            <Slide {...slide} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default HeroSlider; 