import { Router } from 'express';
import * as adapter from '../services/realInvenTreeAdapter';
import { logger } from '../utils/logger';

export function createCrmRouter() {
    const router = Router();

    // GET /leads - List all "Leads" (Companies that are NOT customers yet)
    router.get('/leads', async (req, res) => {
        try {
            // We assume a Lead is a company where is_customer=false (or handled via metadata)
            // For now, we list all non-suppliers to cast a wide net, or filter client-side
            const companies = await adapter.getCompanies({ is_supplier: false });

            // Map InvenTree Company -> CRM Lead
            const leads = companies.map((c: any) => ({
                id: String(c.pk),
                company: c.name,
                contactPerson: c.description || '', // Mapping hack
                email: c.email || '',
                phone: c.phone || '',
                website: c.website || '',
                status: c.metadata?.crm_stage || (c.is_customer ? 'Gewonnen' : 'Neu'),
                value: c.metadata?.crm_value || 0,
                source: c.metadata?.crm_source || 'InvenTree',
                tags: c.is_customer ? ['Kunde'] : ['Lead'],
                createdAt: new Date().toISOString() // InvenTree lacks created_at in basic serializer?
            }));

            res.json(leads);
        } catch (error: any) {
            logger.error(`Error fetching leads: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    // POST /leads - Create a new Lead
    router.post('/leads', async (req, res) => {
        try {
            const body = req.body;
            // Map CRM Lead -> InvenTree Company
            const companyPayload: adapter.InvenTreeCompany = {
                name: body.company || body.contactPerson || 'Unbekannt',
                description: body.contactPerson, // Store contact person in desc for now
                website: body.website,
                email: body.email,
                phone: body.phone,
                is_customer: false,
                is_supplier: false,
                active: true,
                metadata: {
                    crm_stage: body.status || 'Neu',
                    crm_value: body.value,
                    crm_source: body.source,
                    crm_notes: body.notes
                }
            };

            const created = await adapter.createCompany(companyPayload);
            res.status(201).json(created);
        } catch (error: any) {
            logger.error(`Error creating lead: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    // PATCH /leads/:id - Update Stage (e.g. Won)
    router.patch('/leads/:id', async (req, res) => {
        try {
            const id = Number(req.params.id);
            const body = req.body;
            const patch: Partial<adapter.InvenTreeCompany> = {};

            // If status changed to "Gewonnen", make them a customer
            if (body.status === 'Gewonnen') {
                patch.is_customer = true;
            }

            // Sync metadata
            patch.metadata = {
                crm_stage: body.status,
                crm_value: body.value,
                crm_notes: body.notes
            };

            if (body.company) patch.name = body.company;
            if (body.email) patch.email = body.email;

            const updated = await adapter.updateCompany(id, patch);
            res.json(updated);
        } catch (error: any) {
            logger.error(`Error updating lead: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
