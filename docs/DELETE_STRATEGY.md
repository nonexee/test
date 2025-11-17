# Delete Strategy Documentation

## Overview

VendorFlow AI implements a **hard delete strategy with cascading deletes** for maintaining data consistency and simplifying data management. This approach permanently removes data rather than using soft deletes (marking records as deleted while keeping them in the database).

## Rationale

**Why Hard Deletes?**
- **Compliance**: GDPR and data protection regulations require true data deletion capabilities
- **Simplicity**: No need to filter soft-deleted records in every query
- **Storage**: Permanently removes unnecessary data, reducing storage costs
- **Data Integrity**: Cleaner database state without orphaned "deleted" records

**When Soft Deletes Might Be Needed:**
- Audit trail requirements for deleted data
- Regulatory compliance requiring data retention
- Undo functionality for deleted items

If these requirements emerge, soft deletes can be implemented by:
1. Adding `deletedAt: DateTime?` field to models
2. Using Prisma middleware to filter soft-deleted records
3. Updating delete endpoints to set `deletedAt` instead of removing records

## Cascading Delete Configuration

### Tenant Deletions
When a **Tenant** is deleted, the following are automatically cascade-deleted:
- ✅ All **Vendors** belonging to the tenant
- ✅ All **Users** in the tenant
- ✅ All **ExtractionJobs** for the tenant
- ✅ All **AuditLogs** for the tenant

```prisma
model Vendor {
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

### Vendor Deletions
When a **Vendor** is deleted, the following are automatically cascade-deleted:
- ✅ All **Documents** uploaded for the vendor
- ✅ All **VendorFacts** extracted for the vendor
- ✅ All **ExtractionJobs** for the vendor

```prisma
model Document {
  vendor   Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
}

model VendorFacts {
  vendor   Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
}

model ExtractionJob {
  vendor   Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
}
```

**Warning Display**: The frontend shows a warning when deleting vendors:
> "This action cannot be undone. All documents, extracted facts, and extraction jobs associated with this vendor will be permanently deleted."

### User Deletions
When a **User** is deleted:
- ❌ **Documents** uploaded by the user are **NOT deleted** (uses `onDelete: Restrict`)
  - Prevents data loss if a user is removed but their uploaded documents should remain
  - Delete will fail if user has uploaded documents - documents must be reassigned or deleted first
- ✅ **Refresh tokens** for the user are cascade-deleted
- ✅ **Audit logs** set user reference to NULL (uses `onDelete: SetNull`)

```prisma
model Document {
  uploadedBy User @relation(fields: [uploadedByUserId], references: [id], onDelete: Restrict)
}

model AuditLog {
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

## Delete Flow Examples

### Example 1: Deleting a Vendor

**User Action**: Clicks "Delete Vendor" button

**Confirmation Modal Shows**:
```
⚠️ Delete Vendor: Acme Corp?

This action cannot be undone. All documents, extracted facts,
and extraction jobs associated with this vendor will be
permanently deleted.

[Cancel] [Delete Vendor]
```

**Database Operations** (automatic via Prisma):
1. Delete all ExtractionJobs where vendorId = 'vendor-123'
2. Delete all Documents where vendorId = 'vendor-123'
3. Delete VendorFacts where vendorId = 'vendor-123'
4. Delete Vendor where id = 'vendor-123'

**Backend Code** (`vendors.service.ts:129`):
```typescript
async remove(id: string, tenantId: string): Promise<void> {
  const vendor = await this.findOne(id, tenantId);

  // Cascade deletes are automatic via Prisma schema
  await this.prisma.vendor.delete({
    where: { id },
  });
}
```

### Example 2: Deleting a Tenant

**Database Operations** (automatic):
1. For each vendor in tenant:
   - Delete all ExtractionJobs
   - Delete all Documents
   - Delete VendorFacts
   - Delete Vendor
2. Delete all Users in tenant (and their refresh tokens)
3. Delete all AuditLogs for tenant (or set userId to NULL)
4. Delete Tenant

**Impact**: Complete removal of organization and all associated data

### Example 3: Attempting to Delete a User with Documents

**User Action**: Admin tries to delete a user who has uploaded documents

**Database Response**:
```
❌ Foreign key constraint failed
Cannot delete user because they have uploaded documents
```

**Resolution Options**:
1. Reassign documents to another user
2. Delete all documents first
3. Change schema to use `onDelete: Cascade` or `onDelete: SetNull` (requires migration)

## API Endpoints

### Delete Vendor
```http
DELETE /vendors/:id
Authorization: Bearer <token>
```

**Response**:
- `204 No Content` - Successfully deleted
- `404 Not Found` - Vendor doesn't exist or doesn't belong to tenant
- `401 Unauthorized` - Invalid or missing token

### Delete Document
```http
DELETE /vendors/:vendorId/documents/:documentId
Authorization: Bearer <token>
```

**Response**:
- `204 No Content` - Successfully deleted
- `404 Not Found` - Document doesn't exist
- `401 Unauthorized` - Invalid or missing token

## Security Considerations

### Tenant Isolation
All delete operations enforce tenant isolation:
```typescript
// Ensures user can only delete vendors in their tenant
const vendor = await this.prisma.vendor.findFirst({
  where: {
    id,
    tenantId  // 🔒 Tenant isolation enforced
  },
});

if (!vendor) {
  throw new NotFoundException('Vendor not found');
}
```

### Authorization
- Users must be authenticated (JWT required)
- Users can only delete resources in their tenant
- Future enhancement: Role-based permissions (admin-only deletes)

### Audit Trail
Although hard deletes are used, audit logs can track deletion events:
```typescript
// Recommended: Log deletion before removing
await this.auditLog.create({
  action: 'DELETE_VENDOR',
  resourceType: 'VENDOR',
  resourceId: vendor.id,
  userId: user.id,
  tenantId: tenantId,
  metadata: { vendorName: vendor.name }
});

await this.prisma.vendor.delete({ where: { id } });
```

## Migration to Soft Deletes (If Needed)

If future requirements mandate soft deletes:

### 1. Schema Changes
```prisma
model Vendor {
  // Add soft delete field
  deletedAt DateTime?

  // Rest of model...
}
```

### 2. Prisma Middleware
```typescript
// Auto-filter soft-deleted records
prisma.$use(async (params, next) => {
  if (params.model === 'Vendor') {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        deletedAt: null
      };
    }

    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }
  }

  return next(params);
});
```

### 3. Cleanup Job
```typescript
// Cron job to permanently delete old soft-deleted records
async cleanupOldDeletions() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await this.prisma.vendor.deleteMany({
    where: {
      deletedAt: {
        lt: thirtyDaysAgo
      }
    }
  });
}
```

## Best Practices

### 1. Always Warn Users
Show clear warnings about permanent deletion and cascading effects.

### 2. Provide Export Before Delete
Allow users to export data before deletion:
```typescript
// Example: Export vendor data before deletion
const vendorData = await this.exportVendorData(vendorId);
// Send to user email or download
await this.deleteVendor(vendorId);
```

### 3. Implement Confirmation
Require explicit confirmation for destructive operations (already implemented).

### 4. Log Deletions
Create audit trail entries for all deletions.

### 5. Consider Backup Strategy
Ensure database backups are in place for disaster recovery:
- Daily automated backups
- Point-in-time recovery capability
- Regular backup restoration tests

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Strategy** | Hard deletes with cascading |
| **Tenant Isolation** | ✅ Enforced on all operations |
| **User Warnings** | ✅ Confirmation modal shown |
| **Data Recovery** | Via database backups only |
| **Audit Trail** | Can be implemented via AuditLog |
| **Regulatory Compliance** | ✅ True deletion for GDPR/privacy |

The current hard delete strategy with cascading is appropriate for VendorFlow AI's use case, providing clean data management with proper safeguards through tenant isolation and user confirmations.
