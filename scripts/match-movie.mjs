import {readFile} from 'node:fs/promises';
import {createMovieCatalog} from '../lib/movies.mjs';
import {fetchProviderMovie,findProviderMovie,compareMovie,confirmMovieMapping,movieMappingsFile} from '../lib/movie-mappings.mjs';

const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
try{
  const id=option('--tmdb'),link=option('--provider');
  if(!id)throw Error('Usage: node scripts/match-movie.mjs --tmdb ID [--provider MOVIE_LINK] [--local] [--confirm]');
  let token=process.env.TMDB_TOKEN;
  if(!token&&args.includes('--local'))token=JSON.parse(await readFile('.nyx-local.json','utf8')).tmdbToken;
  if(!token)throw Error('Set the existing TMDB_TOKEN, or use --local with Nyx’s private local configuration.');
  const catalog=createMovieCatalog({token:()=>token,mappings:async()=>[]});
  const tmdb=await catalog.details(id);
  const provider=link?await fetchProviderMovie(link):await findProviderMovie(tmdb);
  const comparison=compareMovie(tmdb,provider);
  console.log(JSON.stringify({tmdb:{id:tmdb.id,title:tmdb.title,year:tmdb.releaseDate.slice(0,4),minutes:tmdb.runtime},provider:{title:provider.title,year:provider.releaseDate?.slice(0,4),minutes:provider.duration/60,detailPath:provider.detailPath},...comparison},null,2));
  if(!comparison.compatible)throw Error('Not saved. Resolve the identity mismatch before adding this source.');
  if(args.includes('--confirm')){await confirmMovieMapping(tmdb,provider);console.log('Confirmed mapping saved to '+movieMappingsFile());}
  else console.log('Metadata is compatible. Verify the movie footage, then repeat with --confirm to save.');
}catch(error){console.error(error.message?.startsWith('Usage:')||!/fetch|json|token|authorization/i.test(error.message)?error.message:'Movie metadata could not be loaded; no mapping was saved.');process.exitCode=1;}
