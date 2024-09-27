//#include <uapi/linux/bpf.h>
#include <linux/ip.h>
#include <linux/if_ether.h>
#include <linux/icmp.h>
#include <linux/bpf.h>
//#include <bpf/bpf_helpers.h>

#define ICMP_PROTO 1
#define ICMP_REQUEST 8
#define ICMP_REPLY 0
//#define IP_CSUM_OFF (ETH_HLEN + offsetof(struct iphdr, check))

BPF_HASH(packet_count, u32, u32);

struct data_t {
	__u32 saddr;
	__u32 daddr;
};
BPF_PERF_OUTPUT(events);

int xdp_dodger(struct xdp_md *ctx)
{
    void *data_end = (void *)(long)ctx->data_end;  
    void *data = (void *)(long)ctx->data;
    struct ethhdr *eth = data;
    if ((void *)eth + sizeof(struct ethhdr) > data_end)
        return XDP_PASS;
    struct iphdr *ip = (void *)eth + sizeof(struct ethhdr);
    if ((void *)ip + sizeof(struct iphdr) > data_end)
        return XDP_PASS;
    if (ip->protocol != ICMP_PROTO)
        return XDP_PASS;
    struct icmphdr *icmp = (void *)ip + (ip->ihl * 4);
    if ((void *)icmp + sizeof(struct icmphdr) > data_end)
        return XDP_PASS;
    if (icmp->type != ICMP_REQUEST)
        return XDP_PASS;

    bpf_trace_printk("icmp echo request arrived");

/* swap l2 */
    unsigned char src_mac[6];
    unsigned char dst_mac[6];
    memcpy(src_mac, eth->h_source, 6);
    memcpy(dst_mac, eth->h_dest, 6);
    memcpy(eth->h_source, dst_mac, 6);
    memcpy(eth->h_dest, src_mac, 6);

/* swap l3 */
    __be32 src_ip = ip->saddr;
    __be32 dst_ip = ip->daddr;
	u32 zero = 0;
	u32 *count = packet_count.lookup_or_try_init(&src_ip, &zero);
	if (count) {
		(*count)++;	
		packet_count.update(&src_ip, count);
	}

	__u32 src = ntohl(src_ip);
	__u32 dst = ntohl(dst_ip);
	struct data_t event = {src, dst};
	events.perf_submit(ctx, &event, sizeof(event)); //xdp de tukaeru?
	//int ret = bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &event, sizeof(event));
	//if (ret)
	//	bpf_trace_printk("hello");

    ip->saddr = dst_ip;
    ip->daddr = src_ip;
    //csum = bpf_csum_diff(&src_ip, 4, &ip->saddr, 4, csum); // src/dst is both 32 bit, so aligned with 16 bit, so sum stays the same, and no need to recalculate.
    //csum = bpf_csum_diff(&dst_ip, 4, &ip->daddr, 4, csum);

	uint8_t old_ttl = ip->ttl;
	ip->ttl = 125;
	csum_replace2(&ip->check, old_ttl, ip->ttl);

/* update l4 (icmp type and csum)*/
    icmp->type = ICMP_REPLY; //repyl=0
    csum_replace2(&icmp->checksum, ICMP_REQUEST, ICMP_REPLY);

    //bpf_redirect(ctx->ingress_ifindex, 0); // if other interface?
    //bpf_redirect(2, 0);
    return XDP_TX;
}

