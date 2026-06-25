interface SeedGroup {
  names: string[];
  nutrition: { calories: number; proteinG: number; carbsG: number; fatG: number };
  serving: { label: string; grams: number };
}

export const nutritionSeedGroups: SeedGroup[] = [
  { names: ['Apple', 'Apricot', 'Blackberries', 'Blueberries', 'Cantaloupe', 'Cherries', 'Clementine', 'Cranberries', 'Grapes', 'Grapefruit', 'Kiwi', 'Lemon', 'Lime', 'Mango', 'Orange', 'Papaya', 'Peach', 'Pear', 'Pineapple', 'Plum', 'Pomegranate', 'Raspberries', 'Strawberries', 'Tangerine', 'Watermelon'], nutrition: { calories: 52, proteinG: 0.7, carbsG: 13.5, fatG: 0.3 }, serving: { label: '1 cup', grams: 140 } },
  { names: ['Banana', 'Plantain', 'Persimmon', 'Fig', 'Dates', 'Raisins'], nutrition: { calories: 96, proteinG: 1.2, carbsG: 25, fatG: 0.3 }, serving: { label: '1 medium', grams: 118 } },
  { names: ['Avocado', 'Olives', 'Coconut meat'], nutrition: { calories: 168, proteinG: 2.3, carbsG: 8.8, fatG: 15.2 }, serving: { label: '1/2 cup', grams: 75 } },
  { names: ['Arugula', 'Bok choy', 'Cabbage', 'Collard greens', 'Kale', 'Lettuce', 'Mustard greens', 'Romaine lettuce', 'Spinach', 'Swiss chard', 'Watercress'], nutrition: { calories: 24, proteinG: 2.2, carbsG: 3.9, fatG: 0.4 }, serving: { label: '1 cup', grams: 35 } },
  { names: ['Asparagus', 'Beets', 'Bell pepper', 'Broccoli', 'Brussels sprouts', 'Carrots', 'Cauliflower', 'Celery', 'Cucumber', 'Eggplant', 'Green beans', 'Jicama', 'Leeks', 'Mushrooms', 'Okra', 'Onion', 'Radish', 'Snow peas', 'Summer squash', 'Tomato', 'Turnips', 'Zucchini'], nutrition: { calories: 34, proteinG: 1.8, carbsG: 6.5, fatG: 0.3 }, serving: { label: '1 cup', grams: 120 } },
  { names: ['Potato', 'Sweet potato', 'Yam', 'Parsnips', 'Cassava'], nutrition: { calories: 86, proteinG: 1.8, carbsG: 20.1, fatG: 0.1 }, serving: { label: '1 medium', grams: 150 } },
  { names: ['Black beans', 'Cannellini beans', 'Chickpeas', 'Edamame', 'Kidney beans', 'Lentils', 'Lima beans', 'Navy beans', 'Peas', 'Pinto beans', 'Split peas'], nutrition: { calories: 132, proteinG: 8.4, carbsG: 23.2, fatG: 1.2 }, serving: { label: '1/2 cup cooked', grams: 90 } },
  { names: ['Brown rice', 'Buckwheat', 'Farro', 'Millet', 'Oatmeal', 'Quinoa', 'Wild rice', 'Whole wheat pasta', 'Barley', 'Bulgur'], nutrition: { calories: 118, proteinG: 4.1, carbsG: 23.7, fatG: 1.4 }, serving: { label: '1/2 cup cooked', grams: 90 } },
  { names: ['Corn', 'Rice noodles', 'Sourdough bread', 'Whole grain bread', 'Whole wheat tortilla', 'Corn tortilla', 'English muffin', 'Bagel', 'Pita bread'], nutrition: { calories: 244, proteinG: 7.6, carbsG: 47.3, fatG: 2.9 }, serving: { label: '1 serving', grams: 55 } },
  { names: ['Chicken breast', 'Chicken thigh', 'Ground turkey', 'Turkey breast', 'Pork tenderloin', 'Lean ham'], nutrition: { calories: 165, proteinG: 28.5, carbsG: 0, fatG: 5.1 }, serving: { label: '4 oz', grams: 113 } },
  { names: ['Beef sirloin', 'Bison', 'Ground beef 90%', 'Lamb loin', 'Venison'], nutrition: { calories: 188, proteinG: 26.5, carbsG: 0, fatG: 8.5 }, serving: { label: '4 oz', grams: 113 } },
  { names: ['Bacon', 'Breakfast sausage', 'Chorizo', 'Salami', 'Pepperoni'], nutrition: { calories: 410, proteinG: 18, carbsG: 2.4, fatG: 37 }, serving: { label: '2 oz', grams: 56 } },
  { names: ['Egg', 'Egg whites', 'Duck egg', 'Tofu', 'Tempeh', 'Seitan'], nutrition: { calories: 122, proteinG: 15.3, carbsG: 3.4, fatG: 5.2 }, serving: { label: '1 serving', grams: 90 } },
  { names: ['Cod', 'Halibut', 'Mahi mahi', 'Salmon', 'Sardines', 'Shrimp', 'Tilapia', 'Trout', 'Tuna', 'Scallops'], nutrition: { calories: 146, proteinG: 24.8, carbsG: 0, fatG: 4.9 }, serving: { label: '4 oz', grams: 113 } },
  { names: ['Greek yogurt', 'Cottage cheese', 'Kefir', 'Milk', 'Skim milk', 'Soy milk', 'Almond milk', 'Cheddar cheese', 'Mozzarella', 'Parmesan'], nutrition: { calories: 104, proteinG: 8.2, carbsG: 6.1, fatG: 5.1 }, serving: { label: '1 cup', grams: 245 } },
  { names: ['Butter', 'Ghee', 'Olive oil', 'Avocado oil', 'Canola oil', 'Coconut oil', 'Sesame oil'], nutrition: { calories: 884, proteinG: 0, carbsG: 0, fatG: 100 }, serving: { label: '1 tbsp', grams: 14 } },
  { names: ['Almonds', 'Cashews', 'Hazelnuts', 'Macadamia nuts', 'Peanuts', 'Pecans', 'Pistachios', 'Walnuts', 'Pumpkin seeds', 'Sunflower seeds', 'Chia seeds', 'Flax seeds', 'Hemp seeds'], nutrition: { calories: 580, proteinG: 18.5, carbsG: 17.2, fatG: 49.8 }, serving: { label: '1 oz', grams: 28 } },
  { names: ['Peanut butter', 'Almond butter', 'Tahini'], nutrition: { calories: 610, proteinG: 20.6, carbsG: 21.1, fatG: 52.8 }, serving: { label: '2 tbsp', grams: 32 } },
  { names: ['Black coffee', 'Cold brew coffee', 'Espresso', 'Green tea', 'Herbal tea', 'Sparkling water'], nutrition: { calories: 2, proteinG: 0, carbsG: 0.1, fatG: 0 }, serving: { label: '1 cup', grams: 240 } },
  { names: ['Orange juice', 'Apple cider', 'Coconut water', 'Grape juice', 'Vegetable juice'], nutrition: { calories: 46, proteinG: 0.6, carbsG: 10.9, fatG: 0.2 }, serving: { label: '1 cup', grams: 240 } },
  { names: ['Basil', 'Black pepper', 'Cayenne', 'Cilantro', 'Cinnamon', 'Cumin', 'Garlic', 'Ginger', 'Oregano', 'Paprika', 'Parsley', 'Rosemary', 'Sage', 'Thyme', 'Turmeric'], nutrition: { calories: 280, proteinG: 10.2, carbsG: 52.1, fatG: 7.1 }, serving: { label: '1 tbsp', grams: 6 } },
  { names: ['Honey', 'Maple syrup', 'Jam', 'Jelly'], nutrition: { calories: 278, proteinG: 0.2, carbsG: 75.6, fatG: 0.1 }, serving: { label: '1 tbsp', grams: 20 } },
  { names: ['Tomato sauce', 'Marinara sauce', 'Salsa', 'Hummus', 'Guacamole'], nutrition: { calories: 82, proteinG: 2.2, carbsG: 9.6, fatG: 4.1 }, serving: { label: '1/4 cup', grams: 60 } },
];
