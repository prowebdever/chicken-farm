use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, SetAuthority, Transfer};
use spl_token::instruction::AuthorityType;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod chicken_farm {
    use super::*;

    const CHICKEN_FARM_PDA_SEED : &[u8] = b"chicken-farm";

    pub fn lock(ctx: Context<Lock>, _vault_account_bump: u8) -> ProgramResult {
        let (_vault_authority, _vault_authority_bump) = Pubkey::find_program_address(&[CHICKEN_FARM_PDA_SEED], ctx.program_id);

        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(_vault_authority),
        )?;

        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            1,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(vault_account_bump: u8)]
pub struct Lock<'info> {
    #[account(mut, signer)]
    pub locker: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,
    #[account(init, seeds=[b"chicken-farm-token-seed".as_ref()],bump=vault_account_bump, payer=locker,token::mint=mint,token::authority=locker)]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub locking_account: Account<'info, TokenAccount>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: AccountInfo<'info>,
}
impl<'info> Lock<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority{
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.locker.clone(),    
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.locking_account.to_account_info().clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.locker.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}


#[error]
pub enum ErrorCode {
    #[msg("Invalid staked nft")]
    InvalidStakedNft
}