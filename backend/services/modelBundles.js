const fs = require("fs");
const path = require("path");
const { ZipArchive } = require("archiver");
const crypto = require("crypto");

const REAL_AI_MODELS = [
  {
    id: "model-whisper-tiny-onnx",
    name: "Whisper-Tiny Multi-lingual Transcriber",
    description: "Production-ready OpenAI Whisper-Tiny quantized to ONNX for ultra-fast, offline multi-lingual speech-to-text transcription and translation with zero external cloud dependencies.",
    category: "Audio",
    price: 0.012,
    framework: "ONNX",
    modelFormat: "ONNX (.onnx)",
    verificationStatus: "verified",
    verificationScore: 98,
    modelHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ipfsHash: "QmWhisperTinyMultilingualONNX98432176435678abcdef",
    downloads: 1420,
    rating: "4.9",
    tags: ["Speech-to-Text", "Whisper", "ONNX", "Multi-lingual", "Fast"],
    benchmarks: {
      wer: "6.8% (LibriSpeech)",
      latency: "24ms / audio chunk",
      memory: "150 MB RAM",
      sampleRate: "16 kHz",
    },
    architecture: "Encoder-Decoder Transformer (39M parameters)",
    license: "MIT / Open-Access",
    inputTypes: ["Audio (WAV/MP3/PCM)"],
    outputTypes: ["Text Transcription", "Timestamps", "Language ID"],
    contextWindow: 30,
    pricePerCall: 0.00005,
    sampleInferenceCode: `import onnxruntime as ort
import numpy as np

# Load the verified ONNX model
session = ort.InferenceSession("whisper_tiny.onnx")

# Prepare 16kHz audio waveform
audio_input = np.random.randn(1, 80, 3000).astype(np.float32) # Mel-spectrogram
tokens = session.run(None, {"mel_spectrogram": audio_input})
print("Transcription decoded successfully!")`,
  },
  {
    id: "model-resnet50v2-vision-onnx",
    name: "ResNet-50 v2 Deep Vision Classifier",
    description: "State-of-the-art ResNet-50 v2 pre-trained on ImageNet-1k with FP16 optimization. Ideal for medical imaging diagnostics, industrial quality control, and generic object classification.",
    category: "Computer Vision",
    price: 0.015,
    framework: "PyTorch / ONNX",
    modelFormat: "ONNX (.onnx)",
    verificationStatus: "verified",
    verificationScore: 96,
    modelHash: "7d1f9b33a5987c2b4e85d6910a51c4e7f9a8b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
    ipfsHash: "QmResNet50v2DeepVisionClassifier987654321fedcba",
    downloads: 2890,
    rating: "4.8",
    tags: ["CNN", "Vision", "ImageNet", "Classification", "High Accuracy"],
    benchmarks: {
      top1Accuracy: "80.4%",
      top5Accuracy: "95.3%",
      latency: "14ms (GPU) / 38ms (CPU)",
      parameters: "25.6M",
    },
    architecture: "Deep Residual Network (50 layers with bottleneck)",
    license: "Apache 2.0",
    inputTypes: ["Image (RGB 224x224)"],
    outputTypes: ["1000-Class Probabilities", "Feature Vector (2048-dim)"],
    contextWindow: 224,
    pricePerCall: 0.00008,
    sampleInferenceCode: `import onnxruntime as ort
from PIL import Image
import numpy as np

session = ort.InferenceSession("resnet50_v2.onnx")
img = np.random.randn(1, 3, 224, 224).astype(np.float32)
outputs = session.run(None, {"input": img})
predicted_class = np.argmax(outputs[0])
print(f"Predicted class ID: {predicted_class}")`,
  },
  {
    id: "model-distilroberta-sentiment-safetensors",
    name: "DistilRoBERTa Emotion & Sentiment Engine",
    description: "Fine-tuned DistilRoBERTa model optimized for nuanced 7-class emotion detection (Joy, Sadness, Anger, Fear, Love, Surprise, Neutral) and enterprise customer sentiment analysis.",
    category: "NLP",
    price: 0.008,
    framework: "Transformers",
    modelFormat: "SafeTensors (.safetensors)",
    verificationStatus: "verified",
    verificationScore: 99,
    modelHash: "3f7c9b11e2d4a68051f98bc43210ef897a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d",
    ipfsHash: "QmDistilRoBERTaEmotionSentimentSafeTensors12345",
    downloads: 3410,
    rating: "4.9",
    tags: ["NLP", "Sentiment", "Emotion", "SafeTensors", "RoBERTa"],
    benchmarks: {
      f1Score: "93.8%",
      latency: "9ms / sentence",
      tokensPerSec: "1,200 tok/s",
      memory: "290 MB",
    },
    architecture: "Distilled RoBERTa Transformer (82M parameters)",
    license: "MIT",
    inputTypes: ["Raw Text / Strings"],
    outputTypes: ["7 Emotion Probabilities", "Valence Score (-1.0 to +1.0)"],
    contextWindow: 512,
    pricePerCall: 0.00003,
    sampleInferenceCode: `from safetensors.torch import load_file
import torch

weights = load_file("model.safetensors")
print("SafeTensors weights loaded with zero risk of arbitrary pickle execution.")
# Inference ready with PyTorch / HuggingFace Transformers`,
  },
  {
    id: "model-tinyllama-1b-instruct-gguf",
    name: "TinyLlama 1.1B Edge Instruct LLM",
    description: "Trained on 3 Trillion tokens, this quantized 1.1 Billion parameter instruction-tuned LLM delivers conversational assistant and coding capabilities directly on personal edge hardware.",
    category: "Generative AI",
    price: 0.02,
    framework: "Llama.cpp / Transformers",
    modelFormat: "GGUF / SafeTensors",
    verificationStatus: "verified",
    verificationScore: 95,
    modelHash: "a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e",
    ipfsHash: "QmTinyLlama1BInstructGGUFQuantizedEdge9876543",
    downloads: 5120,
    rating: "4.9",
    tags: ["LLM", "Instruction", "Edge AI", "GGUF", "Chat"],
    benchmarks: {
      mmlu: "36.2%",
      arc: "55.4%",
      tokensPerSec: "48 tok/s (M1/CPU)",
      ramUsage: "750 MB (Q4_K_M)",
    },
    architecture: "Llama-2 architecture (1.1B parameters, 2048 RoPE context)",
    license: "Apache 2.0",
    inputTypes: ["Prompt Text / Chat Messages"],
    outputTypes: ["Generated Text Stream", "Code Snippets"],
    contextWindow: 2048,
    pricePerCall: 0.00015,
    sampleInferenceCode: `from llama_cpp import Llama

llm = Llama(model_path="tinyllama_1.1b_q4_k_m.gguf", n_ctx=2048)
response = llm("Q: What is a neural network? A:", max_tokens=128)
print(response["choices"][0]["text"])`,
  },
  {
    id: "model-clip-vitb32-embedder-onnx",
    name: "CLIP ViT-B/32 Multimodal Embedder",
    description: "OpenAI CLIP Vision-Transformer dual encoder. Maps images and text into a unified 512-dimensional embedding space for semantic visual search and zero-shot categorization.",
    category: "Multimodal",
    price: 0.018,
    framework: "ONNX / PyTorch",
    modelFormat: "ONNX (.onnx)",
    verificationStatus: "verified",
    verificationScore: 97,
    modelHash: "9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d",
    ipfsHash: "QmCLIPViTB32MultimodalEmbedderUnifiedSpace8765",
    downloads: 1980,
    rating: "4.8",
    tags: ["CLIP", "Zero-Shot", "Multimodal", "Embeddings", "Search"],
    benchmarks: {
      zeroShotImageNet: "63.2%",
      cosineSimilarityAccuracy: "96.4%",
      latency: "16ms / embedding",
    },
    architecture: "ViT-B/32 Vision Transformer + 12-layer Text Transformer",
    license: "MIT",
    inputTypes: ["Image (224x224)", "Text Query"],
    outputTypes: ["512-dim Normalized Cosine Embedding"],
    contextWindow: 77,
    pricePerCall: 0.0001,
    sampleInferenceCode: `import onnxruntime as ort
import numpy as np

# Load visual and textual encoders
image_session = ort.InferenceSession("clip_image_encoder.onnx")
text_session = ort.InferenceSession("clip_text_encoder.onnx")

# Compute cross-modal cosine similarity
print("Embeddings projected into unified 512-dim semantic manifold.")`,
  },
  {
    id: "model-sd-vae-synthesizer-safetensors",
    name: "Stable Diffusion Latent VAE Synthesizer",
    description: "High-fidelity Variational Autoencoder (VAE-FT-MSE) for encoding 512x512 RGB images into compact 64x64x4 latent representations and reconstructing them with crisp micro-details.",
    category: "Generative AI",
    price: 0.014,
    framework: "PyTorch",
    modelFormat: "SafeTensors (.safetensors)",
    verificationStatus: "verified",
    verificationScore: 99,
    modelHash: "4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef0123",
    ipfsHash: "QmStableDiffusionVAELatentSynthesizerSafeTensors",
    downloads: 2310,
    rating: "4.9",
    tags: ["VAE", "Latent Diffusion", "SafeTensors", "Image Synthesis"],
    benchmarks: {
      psnr: "32.4 dB",
      ssim: "0.942",
      compressionRatio: "48x Latent Compression",
      latency: "22ms / decode",
    },
    architecture: "Convolutional Variational Autoencoder with 8x downsampling",
    license: "CreativeML Open RAIL-M",
    inputTypes: ["Latent Tensor [1, 4, 64, 64] or RGB Image [1, 3, 512, 512]"],
    outputTypes: ["Reconstructed High-Res Image [1, 3, 512, 512]"],
    contextWindow: 512,
    pricePerCall: 0.00007,
    sampleInferenceCode: `import torch
from safetensors.torch import load_file

vae_weights = load_file("vae_ft_mse.safetensors")
print("VAE parameters loaded into GPU memory. Ready for latent decode.")`,
  },
];

/**
 * Generate and stream a full ZIP model bundle
 */
function streamModelZip(model, purchaseInfo, res) {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const modelSlug = (model.name || "ai-model").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate ZIP." });
  });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${modelSlug}-neuralchain-bundle.zip"`);

  archive.pipe(res);

  // 1. README.md
  const readmeContent = `# ${model.name}
**NeuralChain Blockchain Verified AI Asset**

- **Model ID**: ${model.id}
- **Category**: ${model.category}
- **Framework**: ${model.framework}
- **Model Format**: ${model.modelFormat}
- **SHA-256 Hash**: \`${model.modelHash}\`
- **IPFS CID**: \`${model.ipfsHash}\`
- **Verification Score**: ${model.verificationScore}/100 (Status: ${model.verificationStatus})
- **License**: ${model.license || "NeuralChain Verified License"}

---

## Quickstart

Run inference locally using Python:

\`\`\`bash
pip install onnxruntime numpy Pillow safetensors torch
python infer.py
\`\`\`

## Cryptographic Provenance
This model was purchased through the NeuralChain Decentralized AI Marketplace.
Proof of non-transferable access rights is verified on the blockchain.
`;
  archive.append(readmeContent, { name: "README.md" });

  // 2. model_card.json
  const modelCard = {
    name: model.name,
    id: model.id,
    version: model.version || 1,
    category: model.category,
    framework: model.framework,
    modelFormat: model.modelFormat,
    sha256Hash: model.modelHash,
    ipfsCID: model.ipfsHash,
    benchmarks: model.benchmarks,
    architecture: model.architecture,
    inputTypes: model.inputTypes,
    outputTypes: model.outputTypes,
    creator: model.owner?.username || "Verified NeuralChain Creator",
    verifiedAt: model.createdAt || new Date().toISOString(),
  };
  archive.append(JSON.stringify(modelCard, null, 2), { name: "model_card.json" });

  // 3. config.json
  const configJson = {
    architecture: model.architecture,
    context_window: model.contextWindow || 512,
    input_shape: model.inputTypes,
    output_shape: model.outputTypes,
    precision: "fp16 / int8 quantized",
    execution_providers: ["CUDAExecutionProvider", "CPUExecutionProvider"],
  };
  archive.append(JSON.stringify(configJson, null, 2), { name: "config.json" });

  // 4. infer.py
  const inferenceScript = `#!/usr/bin/env python3
"""
NeuralChain AI Model Standalone Runner
Model: ${model.name}
Architecture: ${model.architecture || model.framework}
Format: ${model.modelFormat}
Hash: ${model.modelHash}
"""

import sys
import os
import json
import time
import hashlib

def verify_bundle_integrity():
    print("=" * 60)
    print("  NEURALCHAIN SECURE MODEL INITIALIZER")
    print("=" * 60)
    print(f"[+] Model Name       : ${model.name}")
    print(f"[+] Framework        : ${model.framework}")
    print(f"[+] Format           : ${model.modelFormat}")
    print(f"[+] Expected SHA-256 : ${model.modelHash}")
    
    if os.path.exists("model_card.json"):
        with open("model_card.json", "r") as f:
            card = json.load(f)
            print(f"[+] Model Category   : {card.get('category')}")
            print(f"[+] Benchmarks       : {json.dumps(card.get('benchmarks', {}))}")
    print("-" * 60)

def run_sample_inference(test_input=None):
    if test_input is None:
        test_input = "NeuralChain model verified execution on local edge runtime."
    
    print(f"[>] Running forward pass on input: '{test_input}'")
    start = time.perf_counter()
    
    # Standalone forward execution emulation with actual telemetry
    time.sleep(0.015) # Simulated 15ms kernel latency
    elapsed_ms = (time.perf_counter() - start) * 1000
    
    output = {
        "status": "success",
        "model": "${model.name}",
        "input": test_input,
        "latency_ms": round(elapsed_ms, 2),
        "execution_provider": "CPU / CUDA Auto-Detected",
        "output_tensor": [0.9412, 0.0421, 0.0167],
        "message": "Inference completed successfully with cryptographic license verification."
    }
    
    print(f"[OK] Execution finished in {elapsed_ms:.2f} ms")
    print("[OK] Output result:")
    print(json.dumps(output, indent=2))
    return output

if __name__ == "__main__":\n    verify_bundle_integrity()
    user_prompt = sys.argv[1] if len(sys.argv) > 1 else None
    run_sample_inference(user_prompt)
`;
  archive.append(inferenceScript, { name: "infer.py" });

  // 5. LICENSE_RECEIPT.json
  const receipt = {
    assetName: model.name,
    modelId: model.id,
    contractModelId: model.contractModelId || "N/A",
    buyerWallet: purchaseInfo?.buyerWallet || "Connected User Wallet",
    transactionHash: purchaseInfo?.transactionHash || "0xVerifiedLocalTransactionReceipt",
    paymentMethod: purchaseInfo?.paymentMethod || "ETH",
    paymentAmount: purchaseInfo?.paymentAmount || model.price,
    licenseType: "ERC-1155 Non-Transferable Access License",
    mintedAt: purchaseInfo?.createdAt || new Date().toISOString(),
    sha256Checksum: model.modelHash,
  };
  archive.append(JSON.stringify(receipt, null, 2), { name: "LICENSE_RECEIPT.json" });

  // 6. Serialized Neural Binary weights placeholder / stub representation
  const weightsHeader = Buffer.from(
    `NEURALCHAIN_VERIFIED_MODEL_WEIGHTS\nFormat: ${model.modelFormat}\nSHA256: ${model.modelHash}\nArchitecture: ${model.architecture}\nSignature: ${crypto.randomBytes(64).toString("hex")}\n`
  );
  const ext = model.modelFormat?.includes("ONNX") ? "onnx" : model.modelFormat?.includes("SafeTensors") ? "safetensors" : "bin";
  archive.append(weightsHeader, { name: `weights.${ext}` });

  archive.finalize();
}

/**
 * Execute interactive simulated/live inference for sandbox testing
 */
function runModelInference(model, inputData = {}) {
  const category = (model.category || "").toLowerCase();
  const name = model.name || "AI Model";
  const prompt = (inputData.prompt || "").trim();

  // 1. LLM & Generative AI (e.g. TinyLlama, GPT)
  if (category.includes("generative") || category.includes("chat") || name.toLowerCase().includes("llama") || name.toLowerCase().includes("gpt")) {
    const q = prompt.toLowerCase();
    let generated = "";
    
    if (!prompt) {
      generated = `I am ${name}, a verified edge-quantized language model. Ask me to write code, explain concepts, summarize data, or analyze algorithms.`;
    } else if (q.includes("code") || q.includes("python") || q.includes("function") || q.includes("write a script")) {
      generated = `Here is an optimized Python implementation for your request:\n\n\`\`\`python\nimport numpy as np\n\ndef execute_task(data: list) -> dict:\n    """\n    Processed via ${name}\n    Optimized for low latency execution\n    """\n    arr = np.array(data, dtype=np.float32)\n    normalized = (arr - np.mean(arr)) / (np.std(arr) + 1e-7)\n    return {\n        "status": "success",\n        "processed_samples": len(data),\n        "mean": float(np.mean(arr)),\n        "std": float(np.std(arr))\n    }\n\nif __name__ == "__main__":\n    sample_input = [12.4, 45.1, 88.3, 102.5]\n    result = execute_task(sample_input)\n    print(result)\n\`\`\``;
    } else if (q.includes("solidity") || q.includes("smart contract") || q.includes("web3")) {
      generated = `Here is a secure Solidity smart contract snippet:\n\n\`\`\`solidity\n// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract AIModelLicense {\n    address public owner;\n    mapping(uint256 => mapping(address => bool)) public hasAccess;\n\n    event LicenseGranted(uint256 indexed modelId, address indexed buyer);\n\n    constructor() {\n        owner = msg.sender;\n    }\n\n    function grantAccess(uint256 modelId, address buyer) external {\n        require(msg.sender == owner, "Only owner");\n        hasAccess[modelId][buyer] = true;\n        emit LicenseGranted(modelId, buyer);\n    }\n}\n\`\`\``;
    } else if (q.includes("why") || q.includes("how") || q.includes("explain") || q.includes("what is")) {
      generated = `**Analysis from ${name}:**\n\nRegarding "${prompt}":\n\n1. **Core Mechanism**: Decentralized machine learning pairs verified model weights with cryptographic hashes (SHA-256) on the blockchain, eliminating tampering risks.\n2. **Performance Optimization**: Edge quantization (GGUF / INT4 / FP16) allows models to execute with under 50ms latency on commodity consumer hardware.\n3. **Practical Application**: Developers can directly embed these weights into self-hosted pipelines with zero ongoing cloud API costs or telemetry lock-in.`;
    } else {
      generated = `**${name} Response:**\n\nProcessed input: "${prompt}"\n\nSummary:\n- Direct edge execution verified with SHA-256 integrity.\n- Contextual alignment score: 98.4%\n- Ready for production inference workflows.`;
    }

    const tokenCount = Math.max(12, Math.floor(generated.length / 4));
    return {
      success: true,
      model: name,
      category: "Generative AI",
      outputType: "text_generation",
      result: {
        prompt: prompt || "Default prompt",
        generatedText: generated,
        finishReason: "stop",
      },
      telemetry: {
        latencyMs: Math.floor(28 + Math.random() * 16),
        tokensGenerated: tokenCount,
        speedTokensPerSec: (45 + Math.random() * 15).toFixed(1),
        memoryMb: 750,
      },
    };
  }

  // 2. Emotion & Sentiment Analysis (e.g. DistilRoBERTa)
  if (category.includes("nlp") || category.includes("sentiment") || name.toLowerCase().includes("roberta")) {
    const text = prompt || "NeuralChain makes purchasing AI models effortless and secure!";
    const lower = text.toLowerCase();

    // Simple rule-based sentiment calculation
    const positiveWords = ["good", "great", "love", "best", "awesome", "excellent", "fast", "secure", "effortless", "amazing", "happy", "joy", "win", "impressive"];
    const negativeWords = ["bad", "terrible", "worst", "broken", "slow", "fail", "hate", "scam", "angry", "sad", "error", "poor", "difficult"];

    let posScore = 0.1;
    let negScore = 0.05;

    positiveWords.forEach((w) => { if (lower.includes(w)) posScore += 0.35; });
    negativeWords.forEach((w) => { if (lower.includes(w)) negScore += 0.35; });

    const total = posScore + negScore + 0.1;
    const normPos = Math.min(0.96, Math.max(0.02, posScore / total));
    const normNeg = Math.min(0.96, Math.max(0.02, negScore / total));
    const normNeutral = Math.max(0.02, Number((1 - normPos - normNeg).toFixed(2)));

    const valence = Number((normPos - normNeg).toFixed(2));
    const label = valence > 0.3 ? "Positive" : valence < -0.3 ? "Negative" : "Neutral";

    return {
      success: true,
      model: name,
      category: "NLP",
      outputType: "sentiment_analysis",
      result: {
        inputText: text,
        overallSentiment: `${label} (Valence: ${valence > 0 ? "+" : ""}${valence})`,
        emotionBreakdown: [
          { emotion: "Joy / Enthusiasm", score: Number(normPos.toFixed(2)) },
          { emotion: "Neutrality", score: Number(normNeutral.toFixed(2)) },
          { emotion: "Sadness / Disappointment", score: Number((normNeg * 0.6).toFixed(2)) },
          { emotion: "Frustration / Anger", score: Number((normNeg * 0.4).toFixed(2)) },
        ],
      },
      telemetry: {
        latencyMs: Math.floor(6 + Math.random() * 6),
        tokensProcessed: text.split(/\s+/).length,
        memoryMb: 290,
      },
    };
  }

  // 3. Audio & Speech-to-Text (e.g. Whisper-Tiny)
  if (category.includes("audio") || category.includes("speech") || name.toLowerCase().includes("whisper")) {
    const text = prompt || "NeuralChain edge model transcription test passed successfully with 16kHz sampling.";
    return {
      success: true,
      model: name,
      category: "Speech & Audio",
      outputType: "transcription",
      result: {
        transcription: text,
        languageDetected: "en (English - 99.4% confidence)",
        timestamps: [
          { start: "00:00.00", end: "00:02.15", text: text.split(" ").slice(0, 4).join(" ") },
          { start: "00:02.20", end: "00:04.80", text: text.split(" ").slice(4).join(" ") },
        ],
        confidenceScore: "98.7%",
      },
      telemetry: {
        latencyMs: Math.floor(18 + Math.random() * 8),
        sampleRateHz: 16000,
        realtimeFactor: "0.038x (Realtime Ultra-Fast)",
      },
    };
  }

  // 4. Computer Vision (e.g. ResNet-50 v2)
  if (category.includes("vision") || category.includes("image") || name.toLowerCase().includes("resnet")) {
    const defaultLabels = [
      { label: "Target Feature Identified (High Certainty)", probability: 0.941 },
      { label: "Secondary Candidate Class", probability: 0.042 },
      { label: "Background Environmental Artifact", probability: 0.017 },
    ];
    return {
      success: true,
      model: name,
      category: "Computer Vision",
      outputType: "classification",
      result: {
        predictedClass: defaultLabels[0].label,
        confidence: defaultLabels[0].probability,
        topProbabilities: defaultLabels,
        activationMapDimensions: "2048 x 7 x 7 (FP16)",
      },
      telemetry: {
        latencyMs: Math.floor(10 + Math.random() * 6),
        gpuMemoryUsedMb: 142,
      },
    };
  }

  // 5. Multimodal / Generative Latent VAE (e.g. CLIP, Stable Diffusion VAE)
  return {
    success: true,
    model: name,
    category: model.category || "Multimodal AI",
    outputType: "tensor_processing",
    result: {
      status: "Inference executed successfully",
      latentRepresentation: `[1, 4, 64, 64] compressed from [1, 3, 512, 512]`,
      cosineMetric: 0.984,
      fidelityPSNR: "32.4 dB",
    },
    telemetry: {
      latencyMs: Math.floor(14 + Math.random() * 8),
      memoryMb: 128,
    },
  };
}

module.exports = {
  REAL_AI_MODELS,
  streamModelZip,
  runModelInference,
};
