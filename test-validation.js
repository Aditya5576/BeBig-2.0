const fs = require('fs');

const legacyWorkout = {
  id: 'legacy_1',
  name: 'Legacy Workout',
  startedAt: '2023-01-01T10:00:00Z',
  status: 'completed',
  exercises: [
    {
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      order: 0,
      actualSets: [
        {
          id: 'set1',
          setNumber: 1,
          weight: 100,
          reps: 10,
          completed: true,
        },
      ],
    },
  ],
};

function isValidSet(set) {
  if (!set || typeof set !== 'object') { console.log('set not obj', set); return false; }
  if (typeof set.id !== 'string' || !set.id.trim()) { console.log('set.id invalid', set.id); return false; }
  if (typeof set.setNumber !== 'number') { console.log('setNumber invalid', set.setNumber); return false; }
  if (typeof set.weight !== 'number' || isNaN(set.weight) || set.weight < 0) { console.log('weight invalid', set.weight); return false; }
  if (typeof set.reps !== 'number' || isNaN(set.reps) || set.reps < 0) { console.log('reps invalid', set.reps); return false; }
  
  if (set.rir !== undefined && set.rir !== null) {
    if (typeof set.rir !== 'number' || isNaN(set.rir) || set.rir < 0 || set.rir > 10) {
      delete set.rir;
    }
  }

  if (typeof set.completed !== 'boolean') { console.log('completed invalid', set.completed); return false; }
  return true;
}

function isValidExercise(ex) {
  if (!ex || typeof ex !== 'object') { console.log('ex not obj'); return false; }
  if (typeof ex.exerciseId !== 'string' || !ex.exerciseId.trim()) { console.log('ex id invalid', ex.exerciseId); return false; }
  if (typeof ex.exerciseName !== 'string') { console.log('ex name invalid', ex.exerciseName); return false; }
  if (typeof ex.order !== 'number') { console.log('ex order invalid', ex.order); return false; }
  if (!Array.isArray(ex.actualSets)) { console.log('ex actualSets not array', ex.actualSets); return false; }
  return ex.actualSets.every(isValidSet);
}

function isValidSession(item) {
  if (!item || typeof item !== 'object') { console.log('item not obj', item); return false; }
  if (typeof item.id !== 'string' || !item.id.trim()) { console.log('item id invalid', item.id); return false; }
  if (typeof item.name !== 'string') { console.log('item name invalid', item.name); return false; }
  if (typeof item.startedAt !== 'string') { console.log('item startedAt invalid', item.startedAt); return false; }
  if (item.status !== 'active' && item.status !== 'completed') { console.log('item status invalid', item.status); return false; }
  if (!Array.isArray(item.exercises)) { console.log('item exercises not array', item.exercises); return false; }
  return item.exercises.every(isValidExercise);
}

console.log('Result:', isValidSession(legacyWorkout));
