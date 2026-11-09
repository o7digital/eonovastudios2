// Execute only in the existing O7 API container. Capture stdout privately.
// Reuses EON's existing tenant. No invitation, payment or message is sent.
const {PrismaClient}=require('@prisma/client');
const {randomBytes}=require('node:crypto');
const bcrypt=require('bcrypt');
const prisma=new PrismaClient();
async function provision(){
 const tenantId='229dd065-2d9c-40fd-81e0-04e2ea009412';
 const subscription=await prisma.subscription.findUnique({where:{customerTenantId:tenantId}});
 if(!subscription||subscription.id!=='3ce2e29b-7ea7-4324-af19-aeb1d83fc077'||subscription.customerName!=='EON NOVA'||subscription.status!=='ACTIVE')throw new Error('Unexpected EON workspace.');
 if(subscription.socialStripeSubscriptionId)throw new Error('Inspect the existing Social billing before changing access.');
 const ownerEmail='olivier.steineur@icloud.com';
 const owner=await prisma.user.findUnique({where:{email:ownerEmail},select:{role:true}});
 if(owner?.role!=='OWNER')throw new Error('The existing owner account is required.');
 const serviceEmail='olivier.steineur+eon-studio@icloud.com';
 let account=await prisma.user.findUnique({where:{email:serviceEmail},select:{id:true,tenantId:true,name:true,role:true}});
 if(account&&(account.tenantId!==tenantId||account.name!=='EON NOVA Studio connector'||account.role!=='ADMIN'))throw new Error('Technical account collision.');
 let servicePassword;
 if(!account){
  if(await prisma.user.count({where:{tenantId}})>=subscription.seats)throw new Error('No free EON technical seat.');
  servicePassword=randomBytes(36).toString('base64url');
  account=await prisma.user.create({data:{email:serviceEmail,name:'EON NOVA Studio connector',tenantId,role:'ADMIN',password:await bcrypt.hash(servicePassword,10)},select:{id:true}});
 }
 await prisma.subscription.update({where:{id:subscription.id},data:{socialEnabled:true}});
 return {tenantId,subscriptionId:subscription.id,ownerEmail,serviceEmail,...(servicePassword?{servicePassword}:{})};
}
provision().then(value=>process.stdout.write(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
