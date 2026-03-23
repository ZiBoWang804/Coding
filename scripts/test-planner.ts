import fs from "node:fs";
import path from "node:path";
import testCases from "@/data/planner-test-cases.json";
import { runPlannerEngine } from "@/lib/planner/planner";
import type { RuralSpotSeed } from "@/types";

function safeText(input: string) {
  return Array.from(input)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126 && code !== 34 && code !== 92;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return safeText(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

async function main() {
  const spots: RuralSpotSeed[] = [];
  const results: unknown[] = [];

  for (const item of testCases as Array<any>) {
    const result = await runPlannerEngine(item, spots, { forceMock: true });
    const visiblePlans = result.recommendedPlans.filter((plan) => !plan.destinationId.startsWith("seed-")).slice(0, 2);
    const plans = visiblePlans.length > 0 ? visiblePlans : result.recommendedPlans.slice(0, 1);

    results.push(sanitize({
      id: item.id,
      input: item,
      output: {
        readableSummary: result.readableSummary,
        recommendedPlans: plans.map((plan) => ({
          destinationId: plan.destinationId,
          destinationName: plan.destinationName,
          totalScore: plan.totalScore,
          scoreBreakdown: plan.scoreBreakdown,
          budgetEstimate: plan.budgetEstimate,
          rankingReason: plan.rankingReason,
          whyFitUser: plan.whyFitUser,
          weatherAdjustmentReason: plan.weatherAdjustmentReason,
          crowdAdjustmentReason: plan.crowdAdjustmentReason,
          risks: plan.risks,
          itinerary: plan.itinerary,
          alternativeOptions: plan.alternativeOptions.filter((option) => !option.destinationId.startsWith("seed-"))
        }))
      }
    }));
  }

  const target = path.resolve(process.cwd(), "data/planner-test-results.json");
  fs.writeFileSync(target, JSON.stringify(results, null, 2), "utf8");
  console.log(`Wrote ${results.length} planner test results to ${target}`);
}

void main();




