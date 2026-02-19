export type ProviderId = "anthropic" | "openai" | "google";
export type SessionStrategy = "reset" | "resume";

export interface ModelOption {
  value: string;
  label: string;
  tag?: string;
}

export interface ThinkingOption {
  value: string;
  label: string;
}

export interface ProviderExecutionInput {
  model: string;
  thinkingValue: string;
  prompt: string;
  cwd: string;
  timeoutMs: number;
  dryRun?: boolean;
  sessionStrategy?: SessionStrategy;
  resumeSessionId?: string;
  outputSchema?: unknown;
  outputSchemaPath?: string;
}

export interface ProviderCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ProviderExecutionResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  responseText: string;
  usedModel: string;
  command: ProviderCommand;
  sessionId?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  cliCommand: string;
  models: ModelOption[];
  thinkingOptions: ThinkingOption[];
  defaultModel: string;
  defaultThinking: string;
  supportsResume: boolean;
  supportsOutputSchemaPath?: boolean;
  supportsJsonSchema?: boolean;
  isInstalled(): Promise<boolean>;
  buildCommand(input: ProviderExecutionInput): ProviderCommand;
  execute(input: ProviderExecutionInput): Promise<ProviderExecutionResult>;
}
