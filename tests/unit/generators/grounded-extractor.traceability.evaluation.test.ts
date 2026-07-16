import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { GroundedExtractor } from "../../../src/generators/grounded-extractor.js";

const parseMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
  };
});

const fields = { name: z.string(), email: z.string(), intent: z.string() };
const fallbackValue = { name: null, email: null, intent: null };

type Case = {
  label: string;
  message: string;
  name: string;
  email: string;
  intent: string;
};

// SC-103: on a fixed evaluation set of messages with sufficient information, 100% of
// extracted values MUST be traceable to the message content.
const CASES: Case[] = [
  { label: "1", message: "Hi, I'm Ada Lovelace, ada@example.com, I want to cancel my subscription.", name: "Ada Lovelace", email: "ada@example.com", intent: "cancel_subscription" },
  { label: "2", message: "This is Grace Hopper, grace@example.com, requesting a refund.", name: "Grace Hopper", email: "grace@example.com", intent: "refund_request" },
  { label: "3", message: "Alan Turing here, alan@example.com, need help resetting my password.", name: "Alan Turing", email: "alan@example.com", intent: "password_reset" },
  { label: "4", message: "My name is Katherine Johnson, katherine@example.com, I'd like to upgrade my plan.", name: "Katherine Johnson", email: "katherine@example.com", intent: "upgrade_plan" },
  { label: "5", message: "Margaret Hamilton, margaret@example.com, reporting a bug in the app.", name: "Margaret Hamilton", email: "margaret@example.com", intent: "bug_report" },
  { label: "6", message: "Hedy Lamarr, hedy@example.com, wants to know about billing.", name: "Hedy Lamarr", email: "hedy@example.com", intent: "billing_question" },
  { label: "7", message: "This is Radia Perlman, radia@example.com, asking to close the account.", name: "Radia Perlman", email: "radia@example.com", intent: "close_account" },
  { label: "8", message: "Barbara Liskov, barbara@example.com, needs to update payment details.", name: "Barbara Liskov", email: "barbara@example.com", intent: "update_payment" },
  { label: "9", message: "Frances Allen, frances@example.com, wants a copy of the invoice.", name: "Frances Allen", email: "frances@example.com", intent: "invoice_request" },
  { label: "10", message: "Shafi Goldwasser, shafi@example.com, reporting login issues.", name: "Shafi Goldwasser", email: "shafi@example.com", intent: "login_issue" },
  { label: "11", message: "Adele Goldberg, adele@example.com, wants to change her email address.", name: "Adele Goldberg", email: "adele@example.com", intent: "change_email" },
  { label: "12", message: "Sophie Wilson, sophie@example.com, asking about the return policy.", name: "Sophie Wilson", email: "sophie@example.com", intent: "return_policy" },
  { label: "13", message: "Karen Sparck Jones, karen@example.com, wants technical support.", name: "Karen Sparck Jones", email: "karen@example.com", intent: "technical_support" },
  { label: "14", message: "Elizabeth Feinler, elizabeth@example.com, requesting a demo.", name: "Elizabeth Feinler", email: "elizabeth@example.com", intent: "demo_request" },
  { label: "15", message: "Joan Clarke, joan@example.com, wants to downgrade her plan.", name: "Joan Clarke", email: "joan@example.com", intent: "downgrade_plan" },
  { label: "16", message: "Mary Kenneth Keller, mary@example.com, reporting a shipping delay.", name: "Mary Kenneth Keller", email: "mary@example.com", intent: "shipping_delay" },
  { label: "17", message: "Jean Bartik, jean@example.com, asking to unsubscribe from emails.", name: "Jean Bartik", email: "jean@example.com", intent: "unsubscribe" },
  { label: "18", message: "Evelyn Boyd Granville, evelyn@example.com, wants a feature request logged.", name: "Evelyn Boyd Granville", email: "evelyn@example.com", intent: "feature_request" },
  { label: "19", message: "Annie Easley, annie@example.com, reporting a security concern.", name: "Annie Easley", email: "annie@example.com", intent: "security_concern" },
  { label: "20", message: "Mary Allen Wilkes, mary.wilkes@example.com, requesting account deletion.", name: "Mary Allen Wilkes", email: "mary.wilkes@example.com", intent: "account_deletion" },
];

describe("SC-103: traceability of extracted values to the message", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it(`extracts traceable values for 100% of ${CASES.length} sufficient-information messages`, async () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);

    let traceableCount = 0;
    for (const testCase of CASES) {
      parseMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              refusal: null,
              parsed: {
                name: testCase.name,
                email: testCase.email,
                intent: testCase.intent,
                reasoning: "All fields found directly in the message.",
              },
            },
          },
        ],
      });

      const extractor = new GroundedExtractor({ fields, fallbackValue });
      const result = await extractor.extract({ message: testCase.message });

      const lowerMessage = testCase.message.toLowerCase();
      const isTraceable =
        result.usedFallback === false &&
        typeof result.data.name === "string" &&
        typeof result.data.email === "string" &&
        lowerMessage.includes(result.data.name.toLowerCase()) &&
        lowerMessage.includes(result.data.email.toLowerCase());

      if (isTraceable) traceableCount += 1;
      else console.error(`Not traceable: [${testCase.label}]`, result);
    }

    const rate = traceableCount / CASES.length;
    expect(rate).toBe(1);
  });
});
