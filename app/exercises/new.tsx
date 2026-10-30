import React from 'react';
import { useRouter } from 'expo-router';
import { CustomExerciseForm } from '../../src/features/exercises';

export default function CreateCustomExerciseScreen() {
  const router = useRouter();

  return (
    <CustomExerciseForm
      onSuccess={() => router.back()}
      onCancel={() => router.back()}
      submitButtonTitle="Save Custom Exercise"
    />
  );
}
