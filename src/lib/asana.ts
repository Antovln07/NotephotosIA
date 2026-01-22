
export async function createAsanaTask({
    token,
    projectId,
    title,
    content,
    photoBase64,
    assigneeId,
    dueOn,
}: {
    token: string;
    projectId: string;
    title: string;
    content: string;
    photoBase64?: string;
    assigneeId?: string;
    dueOn?: string;
}) {
    try {
        // 1. Create Task
        const createResponse = await fetch("https://app.asana.com/api/1.0/tasks", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: {
                    name: title,
                    notes: content,
                    projects: [projectId],
                    assignee: assigneeId,
                    due_on: dueOn,
                },
            }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.text();
            console.error("Asana Create Task Error:", error);
            throw new Error(`Failed to create Asana task: ${error}`);
        }

        const taskData = await createResponse.json();
        const taskGid = taskData.data.gid;

        // 2. Upload Attachment if photo exists
        if (photoBase64) {
            try {
                // Remove data:image/jpeg;base64, prefix if present
                const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                const blob = new Blob([buffer], { type: "image/jpeg" });

                const formData = new FormData();
                formData.append("file", blob, "photo.jpg");

                const attachmentResponse = await fetch(
                    `https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                    }
                );

                if (!attachmentResponse.ok) {
                    console.error("Asana Attachment Error:", await attachmentResponse.text());
                }
            } catch (uploadError) {
                console.error("Error preparing/uploading attachment:", uploadError);
            }
        }

        return taskData.data;
    } catch (error) {
        console.error("createAsanaTask Logic Error:", error);
        throw error;
    }
}

export async function getAsanaProjects(token: string) {
    // 1. Get Workspaces
    const workspacesParams = new URLSearchParams({ opt_fields: "name,gid" });
    const workspacesRes = await fetch(`https://app.asana.com/api/1.0/workspaces?${workspacesParams}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!workspacesRes.ok) throw new Error("Failed to fetch workspaces");
    const workspacesData = await workspacesRes.json();

    // 2. Get Projects for each Workspace
    const allProjects = [];

    for (const workspace of workspacesData.data) {
        const projectsParams = new URLSearchParams({
            workspace: workspace.gid,
            opt_fields: "name,gid,archived",
            archived: "false"
        });

        try {
            const projectsRes = await fetch(`https://app.asana.com/api/1.0/projects?${projectsParams}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (projectsRes.ok) {
                const projectsData = await projectsRes.json();
                allProjects.push(...projectsData.data.map((p: any) => ({
                    ...p,
                    workspaceName: workspace.name,
                    workspaceGid: workspace.gid
                })));
            }
        } catch (e) {
            console.warn(`Failed to fetch projects for workspace ${workspace.name}`, e);
        }
    }

    return allProjects;
}

export async function getWorkspaceUsers(token: string, workspaceId: string) {
    try {
        const usersRes = await fetch(`https://app.asana.com/api/1.0/workspaces/${workspaceId}/users?opt_fields=name,email,gid`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!usersRes.ok) return [];
        const data = await usersRes.json();
        return data.data || [];
    } catch (e) {
        console.error("Failed to fetch workspace users", e);
        return [];
    }
}
