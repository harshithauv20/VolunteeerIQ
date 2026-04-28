import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function smartMatch(task: any, volunteers: any[]) {
  const prompt = `
    Task: ${JSON.stringify(task)}
    Volunteers: ${JSON.stringify(volunteers)}
    
    Assign the top 3 volunteers to this task based on:
    - Skill fit (40%): Semantic understanding of their experience vs task requirements.
    - Reliability (30%): Based on past completions vs cancellations.
    - Availability (20%): Matching task time.
    - Fatigue (10%): Prefer those with fewer tasks in the last 30 days.
    
    Return the result as a JSON array of objects, each with:
    - volunteerId: string
    - matchScore: number (0-100)
    - reason: string (one-line explanation of why they are a good match)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              volunteerId: { type: Type.STRING },
              matchScore: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ["volunteerId", "matchScore", "reason"],
          },
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Smart Match Error:", error);
    return [];
  }
}

export async function generateImpactMessage(volunteer: any, task: any) {
  const prompt = `
    Generate a warm, emotional, and specific impact message for ${volunteer.name} who participated in "${task.task_name}" by ${task.ngo_name}.
    Description of task: ${task.description}
    Use specific numbers where possible (e.g., "helped 34 families").
    Make it feel genuine and encouraging.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Impact Message Error:", error);
    return "Thank you for your incredible contribution today! Your help made a real difference.";
  }
}

export async function getAlternativeMatch(task: any, cancelledVolunteer: any, volunteers: any[], isLateCancellation: boolean) {
  const prompt = `
    URGENT: Volunteer ${cancelledVolunteer.name} just cancelled for the task: "${task.task_name}" scheduled for ${task.date}.
    ${isLateCancellation ? "This is a LATE cancellation (within 48 hours), making it critical to find a replacement immediately." : ""}
    
    Task requirements: ${task.required_skills}.
    
    Identify the best replacement from the pool: ${JSON.stringify(volunteers.filter(v => v.id !== cancelledVolunteer.id))}
    
    CRITERIA:
    1. Availability: Must be free during task time.
    2. Fatigue: Favor those with score < 5 to prevent burnout.
    3. Skills: Semantic match with task description.
    
    Return a JSON object:
    {
      "volunteerId": "string",
      "outreachMessage": "A warm, personalized, and urgent outreach message to invite them to step in."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            volunteerId: { type: Type.STRING },
            outreachMessage: { type: Type.STRING },
          },
          required: ["volunteerId", "outreachMessage"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Reassignment Error:", error);
    return null;
  }
}

export async function getNGOAnalytics(volunteers: any[], tasks: any[]) {
  const prompt = `
    Analyze the following volunteer and task data for an NGO coordinator:
    Volunteers: ${JSON.stringify(volunteers)}
    Tasks: ${JSON.stringify(tasks)}
    
    Identify:
    1. Scarcest skill categories in the pool.
    2. Consistently under-assigned task types.
    3. Top 3 reliable volunteers for leadership roles.
    
    Return as a JSON object with:
    - scarceSkills: string[]
    - underAssignedTasks: string[]
    - topVolunteers: { name: string, reason: string }[]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scarceSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            underAssignedTasks: { type: Type.ARRAY, items: { type: Type.STRING } },
            topVolunteers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Analytics Error:", error);
    return null;
  }
}
