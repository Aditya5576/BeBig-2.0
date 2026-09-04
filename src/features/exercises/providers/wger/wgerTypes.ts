export interface WgerMuscle {
  id: number;
  name: string;
  name_en?: string;
  is_front?: boolean;
  image_url_main?: string;
  image_url_secondary?: string;
}

export interface WgerEquipment {
  id: number;
  name: string;
}

export interface WgerImage {
  id: number;
  uuid: string;
  image: string;
  thumbnails?: {
    small?: string;
    medium?: string;
  };
  is_main?: boolean;
}

export interface WgerTranslation {
  id: number;
  uuid: string;
  name: string;
  description: string;
  description_source?: string;
  language: number; // 2 represents English in Wger
}

export interface WgerCategory {
  id: number;
  name: string;
}

export interface WgerExerciseInfoItem {
  id: number;
  uuid: string;
  category: WgerCategory;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerEquipment[];
  images: WgerImage[];
  translations: WgerTranslation[];
  license?: {
    id: number;
    full_name: string;
    short_name: string;
    url: string;
  };
  license_author?: string;
}

export interface WgerExerciseInfoResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: WgerExerciseInfoItem[];
}
