import { KeyRound, ServerCog } from "lucide-react";
import type { LlmConfig } from "../lib/aiCodeReview";

interface ModelConfigPanelProps {
  config: LlmConfig;
  onChange: (config: LlmConfig) => void;
}

export function ModelConfigPanel({ config, onChange }: ModelConfigPanelProps) {
  function updateConfig(key: keyof LlmConfig, value: string) {
    onChange({
      ...config,
      [key]: value,
    });
  }

  return (
    <aside className="input-panel model-config-panel" aria-label="model config">
      <div className="panel-heading">
        <h2>大模型配置</h2>
        <span>OpenAI-compatible</span>
      </div>
      <section className="import-card">
        <ServerCog size={28} />
        <div>
          <strong>配置第三方大模型后启用 AI 代码评审</strong>
          <p>配置仅保存在当前浏览器会话中，前端会通过后端代理调用模型，避免在代码仓库中暴露密钥。</p>
        </div>
      </section>
      <label>
        BASE_URL
        <input
          value={config.baseUrl}
          onChange={(event) => updateConfig("baseUrl", event.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </label>
      <label>
        API_KEY
        <div className="secret-input">
          <KeyRound size={16} />
          <input
            type="password"
            value={config.apiKey}
            onChange={(event) => updateConfig("apiKey", event.target.value)}
            placeholder="sk-..."
          />
        </div>
      </label>
      <label>
        MODEL
        <input
          value={config.model}
          onChange={(event) => updateConfig("model", event.target.value)}
          placeholder="gpt-4o-mini / qwen-plus / deepseek-chat"
        />
      </label>
    </aside>
  );
}
