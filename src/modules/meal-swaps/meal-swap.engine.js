// src/modules/meal-swaps/meal-swap.engine.js

/**
 * Calculates macro density per gram for a given food.
 */
function getMacroDensities(food) {
  const size = food.servingSize || 100;
  return {
    calories: (food.calories || 0) / size,
    protein: (food.protein || 0) / size,
    carbs: (food.carbs || 0) / size,
    fat: (food.fat || 0) / size,
  };
}

/**
 * Scales the target quantity according to the selected strategy.
 */
export function scaleQuantity(originalFood, targetFood, strategy, originalQuantity) {
  const origDens = getMacroDensities(originalFood);
  const targetDens = getMacroDensities(targetFood);

  const origCalories = origDens.calories * originalQuantity;
  const origProtein = origDens.protein * originalQuantity;
  const origCarbs = origDens.carbs * originalQuantity;
  const origFat = origDens.fat * originalQuantity;

  let suggestedQuantity = originalQuantity;

  switch (strategy) {
    case 'CALORIE_MATCH':
      if (targetDens.calories > 0) {
        suggestedQuantity = origCalories / targetDens.calories;
      }
      break;

    case 'PROTEIN_MATCH':
      if (targetDens.protein > 0) {
        suggestedQuantity = origProtein / targetDens.protein;
      } else if (targetDens.calories > 0) {
        suggestedQuantity = origCalories / targetDens.calories;
      }
      break;

    case 'CARB_MATCH':
      if (targetDens.carbs > 0) {
        suggestedQuantity = origCarbs / targetDens.carbs;
      } else if (targetDens.calories > 0) {
        suggestedQuantity = origCalories / targetDens.calories;
      }
      break;

    case 'FAT_MATCH':
      if (targetDens.fat > 0) {
        suggestedQuantity = origFat / targetDens.fat;
      } else if (targetDens.calories > 0) {
        suggestedQuantity = origCalories / targetDens.calories;
      }
      break;

    case 'BALANCED_MATCH':
    default: {
      const components = [
        { key: 'calories', weight: 0.40, origVal: origCalories, targetDen: targetDens.calories },
        { key: 'protein', weight: 0.20, origVal: origProtein, targetDen: targetDens.protein },
        { key: 'carbs', weight: 0.20, origVal: origCarbs, targetDen: targetDens.carbs },
        { key: 'fat', weight: 0.20, origVal: origFat, targetDen: targetDens.fat },
      ];

      let sumWeightedQuantities = 0;
      let sumWeights = 0;

      for (const comp of components) {
        if (comp.targetDen > 0) {
          const q = comp.origVal / comp.targetDen;
          sumWeightedQuantities += comp.weight * q;
          sumWeights += comp.weight;
        }
      }

      if (sumWeights > 0) {
        suggestedQuantity = sumWeightedQuantities / sumWeights;
      }
      break;
    }
  }

  // Round to 1 decimal place
  return Math.round(suggestedQuantity * 10) / 10;
}

/**
 * Computes energy and macronutrient deltas.
 */
export function calculateDeltas(originalFood, targetFood, originalQuantity, suggestedQuantity) {
  const origDens = getMacroDensities(originalFood);
  const targetDens = getMacroDensities(targetFood);

  const origCals = origDens.calories * originalQuantity;
  const origProt = origDens.protein * originalQuantity;
  const origCarbs = origDens.carbs * originalQuantity;
  const origFat = origDens.fat * originalQuantity;

  const targetCals = targetDens.calories * suggestedQuantity;
  const targetProt = targetDens.protein * suggestedQuantity;
  const targetCarbs = targetDens.carbs * suggestedQuantity;
  const targetFat = targetDens.fat * suggestedQuantity;

  return {
    caloriesDelta: Math.round((targetCals - origCals) * 10) / 10,
    proteinDelta: Math.round((targetProt - origProt) * 10) / 10,
    carbsDelta: Math.round((targetCarbs - origCarbs) * 10) / 10,
    fatDelta: Math.round((targetFat - origFat) * 10) / 10,
  };
}

/**
 * Computes macro distribution similarity distance and applies category penalty.
 */
export function calculateMatchScore(originalFood, targetFood, categoryRelationship = 'DIFFERENT') {
  // 1. Calculate macro energy ratios
  const getMacroRatios = (food) => {
    const p = food.protein || 0;
    const c = food.carbs || 0;
    const f = food.fat || 0;
    const estKcal = (p * 4) + (c * 4) + (f * 9);

    if (estKcal === 0) {
      return { pRatio: 0, cRatio: 0, fRatio: 0 };
    }

    return {
      pRatio: (p * 4) / estKcal,
      cRatio: (c * 4) / estKcal,
      fRatio: (f * 9) / estKcal,
    };
  };

  const origRatios = getMacroRatios(originalFood);
  const targetRatios = getMacroRatios(targetFood);

  const distance =
    Math.abs(origRatios.pRatio - targetRatios.pRatio) +
    Math.abs(origRatios.cRatio - targetRatios.cRatio) +
    Math.abs(origRatios.fRatio - targetRatios.fRatio);

  const macroSimilarity = (1.0 - (distance / 2.0)) * 100;

  // 2. Determine category hierarchy penalties
  let penaltyMultiplier = 0.60;
  let maxScore = 65;

  if (categoryRelationship === 'SAME_CATEGORY') {
    penaltyMultiplier = 0.95;
    maxScore = 95;
  } else if (categoryRelationship === 'SISTER_CATEGORY') {
    penaltyMultiplier = 0.85;
    maxScore = 85;
  } else if (categoryRelationship === 'PARENT_CHILD_CATEGORY') {
    penaltyMultiplier = 0.80;
    maxScore = 80;
  }

  const score = Math.round(macroSimilarity * penaltyMultiplier);
  return Math.max(0, Math.min(maxScore, score));
}
