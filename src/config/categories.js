// src/config/categories.js

export const BUSINESS_CATEGORIES = [
    {
      id: 'cabelos_barba',
      label: 'Cabelos e Barba',
      image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop',
      subcategories: [
        'Salão de Beleza',
        'Barbearia',
        'Studio de Hair Design',
        'Clínica de Tricologia / Terapia Capilar',
        'Espaço de Cachos'
      ]
    },
    {
      id: 'unhas',
      label: 'Unhas, Mãos e Pés',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1974&auto=format&fit=crop',
      subcategories: [
        'Esmalteria',
        'Alongamento de Unhas',
        'Nail Bar',
        'Clínica de Podologia'
      ]
    },
    {
      id: 'face_olhar',
      label: 'Face e Olhar',
      // NOVA IMAGEM: Foco em sobrancelha/olho
      image: 'https://images.unsplash.com/photo-1588510883731-013165b5be37?q=80&w=2070&auto=format&fit=crop',
      subcategories: [
        'Design de Sobrancelhas',
        'Studio de Cílios',
        'Studio Micropigmentação',
        'Ateliê de Maquiagem'
      ]
    },
    {
      id: 'estetica',
      label: 'Estética Corporal',
      image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2070&auto=format&fit=crop',
      subcategories: [
        'Clínica de Estética / Biomédica',
        'Centro de Massoterapia',
        'Spa',
        'Clínica de Bronzearia',
        'Clínica de Depilação'
      ]
    },
    {
      id: 'nichos',
      label: 'Nichos Específicos',
      image: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?q=80&w=1974&auto=format&fit=crop',
      subcategories: [
        'Studio de Tatuagem',
        'Estética Paliativa / Oncológica'
      ]
    }
  ];
  
  export const getCategoryLabel = (id) => {
      const cat = BUSINESS_CATEGORIES.find(c => c.id === id);
      return cat ? cat.label : id;
  };