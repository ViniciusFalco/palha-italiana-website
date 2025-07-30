
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import Slide from './Slide';

const HeroSlider = () => {
  const slides = [
    {
      title: 'PALHA ITALIANA',
      subtitle: 'DOCES ARTESANAIS',
      text: 'Descubra o sabor autêntico da palha italiana artesanal, feita com ingredientes selecionados e muito amor.',
      backgroundImage: '/images/hero-1.jpg'
    },
    {
      title: 'CAPPUCCINO',
      subtitle: 'SABOR ESPECIAL',
      text: 'O sabor mais pedido da casa! Uma combinação perfeita de café e creme que vai te surpreender.',
      backgroundImage: '/images/hero-2.jpg'
    },
    {
      title: 'FAÇA SEU PEDIDO',
      subtitle: 'ENTREGA RÁPIDA',
      text: 'Peça agora e receba em até 2 horas! Qualidade e rapidez para satisfazer sua vontade de doce.',
      backgroundImage: '/images/hero-3.jpg'
    }
  ];

  return (
    <div className="relative">
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
        className="h-screen"
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