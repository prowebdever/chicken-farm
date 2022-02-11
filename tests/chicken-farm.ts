import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { ChickenFarm } from '../target/types/chicken_farm';
import { PublicKey, SystemProgram, Transaction, Connection, Commitment } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { expect, assert } from 'chai';
describe('chicken-farm', () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ChickenFarm as Program<ChickenFarm>;
  const CHICKEN_FARM_PDA_SEED = "chicken-farm";
  const CHICKEN_FARM_TOKEN_SEED = "chicken-farm-token-seed";
  // NFT Token
  let mintA = null as Token;
  let holderTokenAccountA = null;

  let vault_account_pda = null;
  let vault_account_bump = null;
  let vault_authority_pda = null;

  const payer = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();
  const holderMainAccount = anchor.web3.Keypair.generate();

  it('Creating NFT...', async() => {
    // Airdropping SOLs to payer...
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 10000000000),
      "processed"
    );
    // Fund Main Accounts
    await provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: holderMainAccount.publicKey,
            lamports: 1000000000,
          })
        );
        return tx;
      })(),
      [payer]
    );

    // Creating a NFT token...
    mintA = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );
    holderTokenAccountA = await mintA.createAccount(holderMainAccount.publicKey);

    await mintA.mintTo(
      holderTokenAccountA,
      mintAuthority.publicKey,
      [mintAuthority],
      1
    );

    let _holderTokenAccountA = await mintA.getAccountInfo(holderTokenAccountA);
    assert.ok(_holderTokenAccountA.amount.toNumber() == 1);
  });

  it('Locking NFT...', async() => {
    const [_vault_account_pda, _vault_account_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode(CHICKEN_FARM_TOKEN_SEED))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;
    console.log("PDA: ", vault_account_pda.toString());
    console.log("PDA Bump: ", vault_account_bump);
    const [_vault_authority_pda, _vault_authority_bump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode(CHICKEN_FARM_PDA_SEED))],
      program.programId
    );
    vault_authority_pda = _vault_authority_pda;

    await program.rpc.lock(
      vault_account_bump,
      {
        accounts: {
          locker: holderMainAccount.publicKey,
          vaultAccount: vault_account_pda,
          mint: mintA.publicKey,
          lockingAccount: holderTokenAccountA,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID
        },
        signers:[holderMainAccount],
      }
    );
    const [_vault_account_pda2, _vault_account_bump2] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode(CHICKEN_FARM_TOKEN_SEED))],
      program.programId
    );
    console.log("PDA: ", _vault_account_pda2.toString());
    console.log("PDA Bump: ", _vault_account_bump2);
    let _vault = await mintA.getAccountInfo(vault_account_pda);
    assert.ok(_vault.owner.equals(vault_authority_pda));
    assert.ok(_vault.amount.toNumber() == 1);
  });
});
