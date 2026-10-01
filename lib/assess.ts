import { tightenScores, type LabRules } from "./lab-rules";
import {
  CLEAN_INTENT,
  carbonThreat,
  clampTensor,
  matrixOf,
  scoreTensor,
  siliconThreat,
  spatialCompat,
  type DimScores,
  type IntentProfile,
  type Level,
  type Tensor14,
} from "./tensor";

export type PatchStatus = "UNPATCHED" | "PATCHING" | "SECURED" | "ROLLBACKED";

export interface AssessmentView {
  rawScores: DimScores;
  scores: DimScores;
  tensor: Tensor14;
  carbon: Level;
  silicon: Level;
  rawCarbon: Level;
  rawSilicon: Level;
  spatial: number;
  rawSpatial: number;
  matrix: number[];
}

export function assess(
  tensor: Tensor14,
  intents: IntentProfile,
  patchStatus: PatchStatus,
  rules?: LabRules | null,
): AssessmentView {
  const rawScores = tightenScores(scoreTensor(tensor), tensor, rules);
  const secured = patchStatus === "SECURED";
  const shown = secured ? clampTensor(tensor, rawScores) : tensor;
  const effectiveIntents = secured ? CLEAN_INTENT : intents;
  const scores = secured ? scoreTensor(shown) : rawScores;
  return {
    rawScores,
    scores,
    tensor: shown,
    carbon: carbonThreat(scores, effectiveIntents),
    silicon: siliconThreat(scores, effectiveIntents),
    rawCarbon: carbonThreat(rawScores, intents),
    rawSilicon: siliconThreat(rawScores, intents),
    spatial: spatialCompat(effectiveIntents),
    rawSpatial: spatialCompat(intents),
    matrix: matrixOf(scores),
  };
}
