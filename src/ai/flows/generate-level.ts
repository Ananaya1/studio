// src/ai/flows/generate-level.ts
'use server';
/**
 * @fileOverview A level generator AI agent.
 *
 * - generateLevel - A function that handles the level generation process.
 * - GenerateLevelInput - The input type for the generateLevel function.
 * - GenerateLevelOutput - The return type for the generateLevel function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLevelInputSchema = z.object({
  difficulty: z.string().describe('The difficulty level of the game (easy, medium, hard).'),
});
export type GenerateLevelInput = z.infer<typeof GenerateLevelInputSchema>;

const GenerateLevelOutputSchema = z.object({
  levelLayout: z.string().describe('A JSON string representing the layout of the game level, including obstacle positions and spacing.'),
});
export type GenerateLevelOutput = z.infer<typeof GenerateLevelOutputSchema>;

export async function generateLevel(input: GenerateLevelInput): Promise<GenerateLevelOutput> {
  return generateLevelFlow(input);
}

const generateLevelPrompt = ai.definePrompt({
  name: 'generateLevelPrompt',
  input: {schema: GenerateLevelInputSchema},
  output: {schema: GenerateLevelOutputSchema},
  prompt: `You are a game level designer. Generate a level layout for a game with the following characteristics:

Difficulty: {{{difficulty}}}

Return the level layout as a JSON string. The level layout should include obstacle positions and spacing to ensure the game is playable and challenging. Make sure the JSON is a parseable string and use double quotes.

Example:
{
  "obstacles": [
    { "position": 100, "height": 200, "spacing": 300 },
    { "position": 400, "height": 150, "spacing": 250 },
    { "position": 700, "height": 250, "spacing": 350 }
  ]
}`,
});

const generateLevelFlow = ai.defineFlow(
  {
    name: 'generateLevelFlow',
    inputSchema: GenerateLevelInputSchema,
    outputSchema: GenerateLevelOutputSchema,
  },
  async input => {
    const {output} = await generateLevelPrompt(input);
    return output!;
  }
);
