import { describe, it, expect, vi, beforeEach } from "vitest";
import { LengthFinishReasonError, ContentFilterFinishReasonError, APIConnectionError } from "openai/error.mjs";
import { GroundedCall } from "../../../src/core/GroundedCall.js";
import { ContextTooLargeError, ModelUnavailableError, InvalidModelOutputError } from "../../../src/core/errors.js";
import type { GroundedCallConfig } from "../../../src/core/types.js";

const parseMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
  };
});

class TestableGroundedCall extends GroundedCall {
  constructor(config: GroundedCallConfig) {
    super(config);
  }
  public getModel() {
    return this.model;
  }
  public getTemperature() {
    return this.temperature;
  }
  public getClient() {
    return this.client;
  }
  public assertLimit(promptText: string) {
    return this.assertContextWithinLimit(promptText);
  }
  public call(params: any) {
    return this.callModel(params);
  }
  public getSystemPrompt(base: string) {
    return this.buildSystemPrompt(base);
  }
}

describe("GroundedCall construction", () => {
  beforeEach(() => {
    parseMock.mockReset();
    delete process.env["OPENAI_API_KEY"];
  });

  it("throws immediately when fallbackValue is explicitly an empty string", () => {
    expect(() => new TestableGroundedCall({ fallbackValue: "" } as GroundedCallConfig)).toThrow(
      /fallbackValue/i
    );
  });

  it("constructs successfully without fallbackValue", () => {
    process.env["OPENAI_API_KEY"] = "test-key";
    expect(() => new TestableGroundedCall({} as GroundedCallConfig)).not.toThrow();
  });

  it("throws immediately when model is an empty string and no client is provided", () => {
    process.env["OPENAI_API_KEY"] = "test-key";
    expect(
      () => new TestableGroundedCall({ fallbackValue: "sorry", model: "   " })
    ).toThrow(/model/i);
  });

  it("throws when no apiKey and OPENAI_API_KEY is unset", () => {
    expect(() => new TestableGroundedCall({ fallbackValue: "sorry" })).toThrow(/apiKey|OPENAI_API_KEY/i);
  });

  it("applies apiKey/model/temperature defaults when client is omitted", () => {
    process.env["OPENAI_API_KEY"] = "test-key";
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    expect(call.getModel()).toBe("gpt-4o-mini");
    expect(call.getTemperature()).toBe(0);
  });

  it("uses a provided client directly instead of constructing a new one (FR-008)", () => {
    const injectedClient = { beta: { chat: { completions: { parse: vi.fn() } } } } as any;
    const call = new TestableGroundedCall({ fallbackValue: "sorry", client: injectedClient });
    expect(call.getClient()).toBe(injectedClient);
  });
});

describe("GroundedCall context-overflow, technical-failure, and invalid-output guards", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("raises ContextTooLargeError without calling the model", () => {
    const call = new TestableGroundedCall({ fallbackValue: "sorry", maxContextTokens: 10 });
    expect(() => call.assertLimit("a".repeat(1000))).toThrow(ContextTooLargeError);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("raises ModelUnavailableError when the client rejects with a connection error", async () => {
    parseMock.mockRejectedValueOnce(new APIConnectionError({ message: "network down" }));
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call.call({} as any)).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it("raises InvalidModelOutputError when the response fails length finish reason", async () => {
    parseMock.mockRejectedValueOnce(new LengthFinishReasonError());
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call.call({} as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it("raises InvalidModelOutputError when the response fails content filter finish reason", async () => {
    parseMock.mockRejectedValueOnce(new ContentFilterFinishReasonError());
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call.call({} as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it("raises InvalidModelOutputError when the model refuses to respond", async () => {
    parseMock.mockResolvedValueOnce({
      choices: [{ message: { refusal: "I cannot help with that.", parsed: null } }],
    });
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call.call({} as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it("raises InvalidModelOutputError when parsed is null without a refusal", async () => {
    parseMock.mockResolvedValueOnce({
      choices: [{ message: { refusal: null, parsed: null } }],
    });
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call.call({} as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it("returns the parsed payload on success", async () => {
    parseMock.mockResolvedValueOnce({
      choices: [{ message: { refusal: null, parsed: { ok: true } } }],
    });
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call.call({} as any)).resolves.toEqual({ ok: true });
  });

  it("distinguishes all three operational error types and never retries automatically", async () => {
    parseMock.mockRejectedValueOnce(new APIConnectionError({ message: "down" }));
    const call1 = new TestableGroundedCall({ fallbackValue: "sorry" });
    await expect(call1.call({} as any)).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(parseMock).toHaveBeenCalledTimes(1);

    parseMock.mockRejectedValueOnce(new LengthFinishReasonError());
    const call2 = new TestableGroundedCall({ fallbackValue: "sorry", maxContextTokens: 999999 });
    await expect(call2.call({} as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
    expect(parseMock).toHaveBeenCalledTimes(2);

    const call3 = new TestableGroundedCall({ fallbackValue: "sorry", maxContextTokens: 1 });
    expect(() => call3.assertLimit("a".repeat(100))).toThrow(ContextTooLargeError);
    expect(parseMock).toHaveBeenCalledTimes(2);
  });
});

describe("GroundedCall system prompt composition (identity/rules)", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("returns the base prompt unchanged when identity/rules are omitted", () => {
    const call = new TestableGroundedCall({ fallbackValue: "sorry" });
    expect(call.getSystemPrompt("BASE INSTRUCTIONS")).toBe("BASE INSTRUCTIONS");
  });

  it("appends the developer's identity after the base prompt", () => {
    const call = new TestableGroundedCall({
      fallbackValue: "sorry",
      identity: "You are the support assistant for Acme Corp.",
    });
    const prompt = call.getSystemPrompt("BASE INSTRUCTIONS");
    expect(prompt.indexOf("BASE INSTRUCTIONS")).toBe(0);
    expect(prompt).toContain("You are the support assistant for Acme Corp.");
    expect(prompt.indexOf("BASE INSTRUCTIONS")).toBeLessThan(
      prompt.indexOf("You are the support assistant for Acme Corp.")
    );
  });

  it("appends the developer's rules after the base prompt", () => {
    const call = new TestableGroundedCall({
      fallbackValue: "sorry",
      rules: "Always respond in a formal tone.",
    });
    const prompt = call.getSystemPrompt("BASE INSTRUCTIONS");
    expect(prompt.indexOf("BASE INSTRUCTIONS")).toBeLessThan(prompt.indexOf("Always respond in a formal tone."));
  });

  it("appends both identity and rules, always after the base grounding instructions", () => {
    const call = new TestableGroundedCall({
      fallbackValue: "sorry",
      identity: "You are the support assistant for Acme Corp.",
      rules: "Always respond in a formal tone.",
    });
    const prompt = call.getSystemPrompt("BASE INSTRUCTIONS");
    const baseIndex = prompt.indexOf("BASE INSTRUCTIONS");
    const identityIndex = prompt.indexOf("You are the support assistant for Acme Corp.");
    const rulesIndex = prompt.indexOf("Always respond in a formal tone.");
    expect(baseIndex).toBeLessThan(identityIndex);
    expect(identityIndex).toBeLessThan(rulesIndex);
  });
});
