import { z } from "zod";

export const createUserSchema = z.object({
    username: z.string()
    .min(3, "username must be at least 3 characters")
    .max(255, "username must not exceed 255 characters")
    .trim(),

    password: z.string()
    .min(6, "Password must be atleast 6 characters log"),

    name: z.string()
    .min(1, "Name can't be empty")
    .max(50)
    .trim(),
});


export const signinSchema = z.object({
    username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(255, "Username must not exceed 255 characters")
    .trim(),

  password: z.string()
    .min(6, "Password must be at least 6 characters long"), 
});



export const CreateRoomSchema = z.object({
    name: z.string()
    .min(3, "Room name must be at least 3 characters")
    .max(20, "Room name must not exceed 20 characters")
    .trim(),
})

export const DrawEventSchema = z.object({
    roomId: z.number(),
    shapeType: z.string(),
    shapeData: z.any()
});

export type DrawEvent = z.infer<typeof DrawEventSchema>;

// ═══════════════════════════════════════════════════════════
// SKETCHUI — SaaS API Schemas
// ═══════════════════════════════════════════════════════════

export const CreateWorkspaceSchema = z.object({
    name: z.string()
        .min(1, "Workspace name is required")
        .max(50, "Workspace name must not exceed 50 characters")
        .trim(),
    plan: z.enum(["free", "pro", "team"]).optional().default("free"),
});

export const CreateProjectSchema = z.object({
    workspaceId: z.string().uuid("Invalid workspace ID"),
    name: z.string()
        .min(1, "Project name is required")
        .max(50, "Project name must not exceed 50 characters")
        .trim(),
    roomId: z.number().int().optional(),
});

export const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(50).trim().optional(),
    layoutTree: z.any().optional(),
    generatedCode: z.any().optional(),
    framework: z.enum(["react", "html"]).optional(),
});

export const GenerateCodeSchema = z.object({
    layoutTree: z.any(),
    framework: z.enum(["react", "html"]).optional().default("react"),
    componentName: z.string()
        .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "Component name must be alphanumeric")
        .optional()
        .default("GeneratedComponent"),
});

export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
export type GenerateCode = z.infer<typeof GenerateCodeSchema>;