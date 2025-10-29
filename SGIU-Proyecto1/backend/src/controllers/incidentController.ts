import { Request, Response } from 'express';
import db from '../db';

export const createIncident = async (req: Request, res: Response) => {
  const { title, description, category, location } = req.body;
  const userId = req.user?.id;
  const files = req.files as Express.Multer.File[];

  let satisfaction: number | null = null;
  if (req.body.satisfaction !== undefined && req.body.satisfaction !== null && req.body.satisfaction !== '') {
    const parsed = Number(req.body.satisfaction);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
      return res.status(400).json({ message: 'La satisfacción debe ser un número entre 1 y 5.' });
    }
    satisfaction = Math.round(parsed);
  }

  if (!title || !description || !category || !location) {
    return res.status(400).json({ message: 'Todos los campos son requeridos.' });
  }

  try {
    const satisfactionRaw = req.body.satisfaction;
const satisfaction = satisfactionRaw ? Math.max(1, Math.min(5, parseInt(satisfactionRaw))) : null;

const newIncident = await db.query(
  `INSERT INTO incidents (title, description, category, location, user_id, satisfaction)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
  [title, description, category, location, userId, satisfaction]
);
    const incidentId = newIncident.rows[0].id;

    if (files && files.length > 0) {
      for (const file of files) {
        const imageUrl = `/uploads/${file.filename}`;
        await db.query(
          'INSERT INTO incident_images (incident_id, image_url) VALUES ($1, $2)',
          [incidentId, imageUrl]
        );
      }
    }
    
    res.status(201).json(newIncident.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear la incidencia.' });
  }
};

export const getUserIncidents = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const result = await db.query('SELECT * FROM incidents WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
};

export const getAllIncidents = async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
    SELECT
        i.*,
        u.name AS user_name,
        u.email AS user_email,
        COALESCE(ARRAY_AGG(ii.image_url) FILTER (WHERE ii.image_url IS NOT NULL), '{}') AS images
    FROM
        incidents i
    JOIN
        users u ON i.user_id = u.id
    LEFT JOIN
        incident_images ii ON i.id = ii.incident_id
    GROUP BY
        i.id, u.id
    ORDER BY
        i.created_at DESC
`);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
};
export const deleteIncident = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM incidents WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Incidencia no encontrada.' });
    }
    return res.json({ message: 'Incidencia eliminada correctamente.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al eliminar la incidencia.' });
  }
};

export const updateIncidentStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ message: 'Estado inválido.' });
  }

  try {
    const result = await db.query(
      'UPDATE incidents SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Incidencia no encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
};
