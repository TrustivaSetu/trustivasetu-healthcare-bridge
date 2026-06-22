import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

interface FileData {
  name: string;
  data: string;
  mediaType: string;
}

interface RequestBody {
  clinicName: string;
  clinicType: string;
  clinicCity: string;
  clinicBranches: string;
  clinicWebsite: string;
  clinicCost: string;
  clinicContext: string;
  files: FileData[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { clinicName, clinicType, clinicCity, clinicBranches, clinicWebsite, clinicCost, clinicContext, files } = body;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageContent: any[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.mediaType.startsWith("image/")) {
          const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
          const mediaType = validImageTypes.includes(file.mediaType)
            ? (file.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
            : ("image/jpeg" as const);
          messageContent.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data: file.data },
          });
        } else if (file.mediaType === "application/pdf") {
          messageContent.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf" as const, data: file.data },
          });
        }
      }
    }

    const docSummary = files && files.length > 0
      ? `User ne ${files.length} document(s) upload kiye: ${files.map((f: FileData) => f.name).join(", ")}. Carefully analyse karo.`
      : "Koi document upload nahi hua. Web search aur provided info pe base karo.";

    messageContent.push({
      type: "text",
      text: `You are IVA Score AI — intelligent vendor assessment engine for TrustivaSetu, a healthcare financing marketplace enabling zero-percent EMI for elective medical procedures (dental, IVF, hair transplant, ophthalmology, cosmetic).

Assess whether TrustivaSetu should onboard this clinic as a partner.

CLINIC DETAILS:
- Name: ${clinicName}
- Type: ${clinicType}
- City: ${clinicCity || "Not specified"}
- Branches: ${clinicBranches || "Not specified"}
- Website: ${clinicWebsite || "Not provided"}
- Avg Procedure Cost: ${clinicCost ? "₹" + parseInt(clinicCost).toLocaleString("en-IN") : "Not specified"}
- Context: ${clinicContext || "None"}

DOCUMENTS: ${docSummary}

TASKS:
1. Search web for: "${clinicName} ${clinicCity} reviews complaints", "${clinicName} reputation India"
2. Analyse documents for compliance, financials, red flags
3. Score on 6 dimensions (0-10 each):
   - Compliance & Licensing
   - Financial Health
   - Reputation & Reviews
   - Patient Volume Potential
   - EMI Readiness
   - Risk Flags (10 = no risk, 0 = high risk)
4. IVA Score = weighted avg (compliance 20%, financial 20%, reputation 20%, volume 15%, EMI 15%, risk 10%) x 10
5. Verdict: 75-100 ONBOARD | 50-74 REVIEW | 0-49 DECLINE

RESPOND IN STRICT JSON ONLY — no markdown, no preamble:
{
  "score": <integer 0-100>,
  "verdict": "ONBOARD" | "REVIEW" | "DECLINE",
  "sub_scores": {
    "compliance": <0-10>,
    "financial": <0-10>,
    "reputation": <0-10>,
    "volume": <0-10>,
    "emi_readiness": <0-10>,
    "risk": <0-10>
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "red_flags": ["flag 1", "flag 2"],
  "analysis": "<3-4 paragraph detailed analysis>",
  "recommendation": "<2-3 sentence final recommendation>",
  "sources_found": <integer>
}`,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
      messages: [{ role: "user", content: messageContent }],
    });

    const textBlocks = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const clean = textBlocks.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : clean);

    return Response.json({ success: true, data: result });

  } catch (error: unknown) {
    console.error("IVA Score API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}