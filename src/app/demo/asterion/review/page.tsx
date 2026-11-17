import {notFound} from 'next/navigation';
import {MapReview} from '@/features/game/components/MapReview';
export default function Page(){if(process.env.MAP_REVIEW_ENABLED!=='true')notFound();return <MapReview/>;}
