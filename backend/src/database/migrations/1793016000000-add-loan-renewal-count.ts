import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * SPEC-LIB-03: renovación de préstamos. No se toca la migración inicial: el esquema
 * solo avanza con migraciones nuevas.
 *
 * - Los préstamos que ya existían parten con renewal_count = 0 (DEFAULT 0).
 * - RENEW-R2: CHECK 0 <= renewal_count <= 1. Si el código fallara y renovara dos veces,
 *   la base de datos lo rechaza igual.
 */
export class AddLoanRenewalCount1793016000000 implements MigrationInterface {
  name = 'AddLoanRenewalCount1793016000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE loans
        ADD COLUMN renewal_count integer NOT NULL DEFAULT 0,
        ADD CONSTRAINT ck_loans_renewal_count CHECK (renewal_count BETWEEN 0 AND 1)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE loans DROP CONSTRAINT ck_loans_renewal_count`)
    await queryRunner.query(`ALTER TABLE loans DROP COLUMN renewal_count`)
  }
}
