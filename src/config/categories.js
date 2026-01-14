// src/config/categories.js

export const BUSINESS_CATEGORIES = [
  {
    id: 'cabelos_barba',
    label: 'Cabelos e Barba',
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
    subcategories: [
      'Design de Sobrancelhas',
      'Studio de Cílios',
      'Studio Micropigmentação',
      'Ateliê de Maquiagem'
    ]
  },
  {
    id: 'estetica',
    label: 'Estética Corporal e Facial',
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
    subcategories: [
      'Studio de Tatuagem',
      'Estética Paliativa / Oncológica'
    ]
  }
];

// Função auxiliar para encontrar o nome bonito pelo ID
export const getCategoryLabel = (id) => {
    const cat = BUSINESS_CATEGORIES.find(c => c.id === id);
    return cat ? cat.label : id;
};