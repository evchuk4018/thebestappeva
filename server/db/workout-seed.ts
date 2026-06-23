export interface PresetExercise { name: string; category: string; equipment: string; }

const groups: Record<string, Record<string, string[]>> = {
  Chest: {
    Barbell: ['Bench Press', 'Incline Bench Press', 'Close Grip Bench Press'],
    Dumbbell: ['Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly'],
    Machine: ['Chest Press', 'Pec Deck', 'Chest Fly'],
    Cable: ['Cable Fly', 'Low Cable Fly', 'High Cable Fly'],
    Bodyweight: ['Push Up', 'Dip'],
  },
  Back: {
    Barbell: ['Deadlift', 'Bent Over Row', 'T-Bar Row'],
    Dumbbell: ['One Arm Dumbbell Row', 'Chest Supported Row'],
    Machine: ['Lat Pulldown', 'Seated Cable Row', 'Assisted Pull Up'],
    Cable: ['Straight Arm Pulldown', 'Face Pull'],
    Bodyweight: ['Pull Up', 'Chin Up', 'Inverted Row'],
  },
  Legs: {
    Barbell: ['Back Squat', 'Front Squat', 'Romanian Deadlift', 'Hip Thrust'],
    Dumbbell: ['Goblet Squat', 'Dumbbell Lunge', 'Bulgarian Split Squat'],
    Machine: ['Leg Press', 'Leg Extension', 'Seated Leg Curl', 'Lying Leg Curl', 'Hack Squat', 'Calf Raise'],
    Bodyweight: ['Walking Lunge', 'Step Up', 'Glute Bridge'],
  },
  Shoulders: {
    Barbell: ['Overhead Press', 'Push Press'],
    Dumbbell: ['Dumbbell Shoulder Press', 'Lateral Raise', 'Rear Delt Fly', 'Arnold Press'],
    Machine: ['Machine Shoulder Press', 'Reverse Pec Deck'],
    Cable: ['Cable Lateral Raise', 'Cable Rear Delt Fly'],
  },
  Arms: {
    Barbell: ['Barbell Curl', 'Skullcrusher', 'EZ Bar Curl'],
    Dumbbell: ['Hammer Curl', 'Incline Dumbbell Curl', 'Overhead Triceps Extension'],
    Cable: ['Triceps Pushdown', 'Rope Pushdown', 'Cable Curl', 'Bayesian Curl'],
    Machine: ['Preacher Curl', 'Triceps Extension'],
  },
  Core: {
    Bodyweight: ['Plank', 'Side Plank', 'Hanging Leg Raise', 'Crunch', 'Mountain Climber'],
    Cable: ['Cable Crunch', 'Pallof Press', 'Wood Chop'],
    Machine: ['Ab Crunch Machine', 'Back Extension'],
  },
  Cardio: {
    Cardio: ['Treadmill Run', 'Indoor Bike', 'Rowing Machine', 'Elliptical', 'Stair Climber', 'Jump Rope'],
  },
};

export const presetExercises: PresetExercise[] = Object.entries(groups).flatMap(([category, byEquipment]) =>
  Object.entries(byEquipment).flatMap(([equipment, names]) => names.map((name) => ({ name, category, equipment }))),
);

export const defaultRoutines = [
  { name: 'Chest and triceps', exercises: ['Bench Press', 'Chest Fly', 'Triceps Pushdown'] },
  { name: 'Back and biceps', exercises: ['Bent Over Row', 'Lat Pulldown', 'Seated Cable Row', 'Barbell Curl'] },
  { name: 'Legs and abs', exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Cable Crunch'] },
] as const;
