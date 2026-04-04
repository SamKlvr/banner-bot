import { config } from "./config.js";

const BASE_URL = "https://api.kie.ai/api/v1/jobs";

export async function generateImage(prompt, aspectRatio) {
  const taskId = await createTask(prompt, aspectRatio);
  const imageUrl = await waitForImage(taskId);
  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  return {
    taskId,
    imageUrl,
    imageBuffer
  };
}

async function createTask(prompt, aspectRatio) {
  const response = await fetch(`${BASE_URL}/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.kieApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/nano-banana",
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        resolution: "1K"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Kie createTask failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data.taskId;
}

async function waitForImage(taskId) {
  const maxAttempts = 75;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(4000);

    const response = await fetch(`${BASE_URL}/recordInfo?taskId=${taskId}`, {
      headers: {
        Authorization: `Bearer ${config.kieApiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Kie recordInfo failed: ${response.status}`);
    }

    const data = await response.json();
    const state = data.data?.state;

    if (state === "success") {
      const parsed = JSON.parse(data.data.resultJson);
      return parsed.resultUrls[0];
    }

    if (state === "failed") {
      throw new Error("Kie image generation failed");
    }
  }

  throw new Error("Kie image generation timed out");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
