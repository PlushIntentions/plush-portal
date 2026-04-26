export const onRequestPost = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { action, payload } = body || {};

  const CLICKUP_API_TOKEN = env.CLICKUP_API_TOKEN;
  const CLICKUP_TEAM_ID = env.CLICKUP_TEAM_ID;
  const TECH_LIST_ID = env.CLICKUP_TECHNICIANS_LIST_ID;
  const WORK_LIST_ID = env.CLICKUP_WORK_ORDERS_LIST_ID;

  if (!CLICKUP_API_TOKEN || !CLICKUP_TEAM_ID || !TECH_LIST_ID || !WORK_LIST_ID) {
    return json({ error: 'Missing env config' }, 500);
  }

  try {
    switch (action) {
      case 'login':
        return await handleLogin(payload, CLICKUP_API_TOKEN, TECH_LIST_ID);
      case 'getDashboardData':
        return await handleDashboard(payload, CLICKUP_API_TOKEN, TECH_LIST_ID, WORK_LIST_ID);
      case 'getWorkOrder':
        return await handleWorkOrder(payload, CLICKUP_API_TOKEN);
      case 'requestJob':
        return await handleRequestJob(payload, CLICKUP_API_TOKEN);
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: e.message || 'Server error' }, 500);
  }
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function handleLogin(payload, token, techListId) {
  const { email } = payload || {};
  if (!email) return json({ error: 'Email required' }, 400);

  const res = await fetch(`https://api.clickup.com/api/v2/list/${techListId}/task`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error('Failed to load technicians');
  const data = await res.json();

  const tasks = data.tasks || [];
  const techTask = tasks.find((t) => {
    const fields = t.custom_fields || [];
    const emailField = fields.find((f) => f.name === 'Technician Email');
    return emailField && (emailField.value || '').toLowerCase() === email.toLowerCase();
  });

  if (!techTask) return json({ error: 'Technician not found' }, 401);

  const fields = techTask.custom_fields || [];
  const getField = (name) => (fields.find((f) => f.name === name) || {}).value;

  const tech = {
    id: techTask.id,
    name: techTask.name,
    email,
    technicianId: getField('Technician ID') || null,
    baseLocation: getField('Tech Base Location') || null,
    radiusMiles: Number(getField('Preferred Work Radius (Miles)') || 0),
  };

  return json({ success: true, tech });
}

async function handleDashboard(payload, token, techListId, workListId) {
  const { tech } = payload || {};
  if (!tech || !tech.email) return json({ error: 'Tech required' }, 400);

  const res = await fetch(`https://api.clickup.com/api/v2/list/${workListId}/task`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error('Failed to load work orders');
  const data = await res.json();
  const tasks = data.tasks || [];

  const workOrders = tasks.map((t) => mapWorkOrder(t, tech, false));
  return json({ tech, workOrders });
}

async function handleWorkOrder(payload, token) {
  const { tech, taskId } = payload || {};
  if (!tech || !taskId) return json({ error: 'Tech and taskId required' }, 400);

  const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error('Failed to load work order');
  const t = await res.json();

  const workOrder = mapWorkOrder(t, tech, true);
  return json({ workOrder });
}

async function handleRequestJob(payload, token) {
  const { tech, parentTaskId } = payload || {};
  if (!tech || !parentTaskId) return json({ error: 'Tech and parentTaskId required' }, 400);

  const now = new Date();
  const ts = now.toISOString();
  const name = `Assignment Request – ${tech.name} – ${ts}`;

  const body = {
    name,
    parent: parentTaskId,
    description: `Technician ${tech.name} (${tech.email}) is requesting assignment for this work order.\n\nTech ID: ${tech.technicianId || 'N/A'}\nRequested at: ${ts}`,
    status: 'Pending Review',
  };

  const res = await fetch(`https://api.clickup.com/api/v2/task`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('Failed to create assignment request');
  const subtask = await res.json();

  return json({ success: true, subtask });
}

function mapWorkOrder(task, tech, includeAttachments = false) {
  const fields = task.custom_fields || [];
  const getField = (name) => (fields.find((f) => f.name === name) || {}).value;

  const assignedTech = getField('Assigned Technician') || '';
  const isAssignedToThisTech =
    assignedTech &&
    tech &&
    assignedTech.toString().trim().toLowerCase() === tech.name.toString().trim().toLowerCase();

  const serviceAddress = getField('Service Address') || '';
  const priority = getField('Priority') || task.priority?.priority || 'Normal';

  const base = {
    id: task.id,
    name: task.name,
    status: task.status?.status || '',
    priority,
    isAssignedToThisTech,
    assignedTechnician: assignedTech || null,
  };

  if (!isAssignedToThisTech) {
    return {
      ...base,
      serviceAddress: null,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      notes: null,
      attachments: includeAttachments ? [] : undefined,
      privacy: {
        mode: 'unassigned',
        message: 'General Service Area — Exact address hidden until assignment.',
      },
    };
  }

  const attachments =
    includeAttachments && task.attachments
      ? task.attachments.map((a) => ({
          id: a.id,
          url: a.url,
          title: a.title,
          size: a.size,
        }))
      : undefined;

  return {
    ...base,
    serviceAddress,
    customerName: getField('Customer Name') || null,
    customerPhone: getField('Customer Phone') || null,
    customerEmail: getField('Customer Email') || null,
    notes: getField('Notes') || null,
    attachments,
    privacy: { mode: 'assigned' },
  };
}
